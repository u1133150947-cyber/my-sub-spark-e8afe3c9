// Minimal PostgREST-compatible HTTP layer over SQLite.
// Implements only what @supabase/supabase-js v2 emits for this project:
//   GET  /rest/v1/<table>?select=...&col=eq.x&col=in.(a,b)&col=gte.x&order=col.asc
//        Headers: Prefer: count=exact, Range, Prefer: return=representation
//   POST /rest/v1/<table>           body: row|rows, Prefer: return=representation, resolution=merge-duplicates (upsert)
//   PATCH/DELETE /rest/v1/<table>?col=eq.x
//
// ALL endpoints require a valid admin session token:
//   x-admin-token: <token>  OR  Authorization: Bearer <token>
import { db, decodeRow, encodeRow, tableColumns, uid } from "./db.ts";
import { verifyAdminSession, unauthorizedResponse } from "./auth.ts";
import { encryptField, decryptField, PANEL_SENSITIVE_COLS } from "./crypto.ts";

// Columns that should be encrypted at rest for the panels table.
const PANEL_SENSITIVE = new Set<string>(PANEL_SENSITIVE_COLS);

/** Encrypt sensitive fields before writing to DB. */
async function encryptRow(table: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (table !== "panels") return row;
  const out = { ...row };
  for (const col of PANEL_SENSITIVE) {
    if (typeof out[col] === "string" && out[col]) {
      out[col] = await encryptField(out[col] as string);
    }
  }
  return out;
}

/** Decrypt sensitive fields after reading from DB. */
async function decryptRow(table: string, row: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (table !== "panels") return row;
  const out = { ...row };
  for (const col of PANEL_SENSITIVE) {
    if (typeof out[col] === "string") {
      out[col] = await decryptField(out[col] as string);
    }
  }
  return out;
}

const ALLOWED = new Set([
  "panels", "subscriptions", "subscription_inbounds",
  "inbound_overrides", "client_mappings", "traffic_snapshots", "audit_log",
  "external_subs", "subscription_external_subs",
]);

// Tables that are read-only via the REST API — writes go through dedicated handlers.
const READ_ONLY = new Set(["audit_log"]);

const OP_MAP: Record<string, string> = {
  eq: "=", neq: "!=", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "LIKE", ilike: "LIKE",
};

// Columns that hold timestamps — comparisons must be normalized via datetime()
// because the local SQLite store writes "YYYY-MM-DD HH:MM:SS" while the
// supabase-js client compares against ISO "YYYY-MM-DDTHH:MM:SS.sssZ".
const TS_COLS = new Set([
  "created_at", "updated_at", "ts", "checked_at", "last_accessed_at", "last_checked_at", "expires_at",
]);
const RANGE_OPS = new Set(["gt", "gte", "lt", "lte", "eq", "neq"]);

function isIdent(s: string) { return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s); }

type Filter = { col: string; sql: string; args: unknown[] };

function parseFilters(table: string, params: URLSearchParams): Filter[] {
  const cols = new Set(tableColumns(table));
  const filters: Filter[] = [];
  for (const [key, raw] of params.entries()) {
    if (["select", "order", "limit", "offset"].includes(key)) continue;
    if (!cols.has(key) || !isIdent(key)) continue;
    const idx = raw.indexOf(".");
    if (idx < 0) continue;
    const op = raw.slice(0, idx);
    const val = raw.slice(idx + 1);
    if (op === "in") {
      const inside = val.replace(/^\(/, "").replace(/\)$/, "");
      const items = inside.length ? inside.split(",").map((x) => decodeURIComponent(x.replace(/^"|"$/g, ""))) : [];
      if (!items.length) { filters.push({ col: key, sql: "0=1", args: [] }); continue; }
      filters.push({ col: key, sql: `${key} IN (${items.map(() => "?").join(",")})`, args: items });
    } else if (op === "is") {
      filters.push({ col: key, sql: val === "null" ? `${key} IS NULL` : `${key} IS NOT NULL`, args: [] });
    } else if (OP_MAP[op]) {
      if (TS_COLS.has(key) && RANGE_OPS.has(op)) {
        filters.push({ col: key, sql: `datetime(${key}) ${OP_MAP[op]} datetime(?)`, args: [val] });
      } else {
        filters.push({ col: key, sql: `${key} ${OP_MAP[op]} ?`, args: [val] });
      }
    }
  }
  return filters;
}

function whereFromFilters(filters: Filter[]): { sql: string; args: unknown[] } {
  if (!filters.length) return { sql: "", args: [] };
  return { sql: " WHERE " + filters.map((f) => f.sql).join(" AND "), args: filters.flatMap((f) => f.args) };
}

function selectColumns(table: string, sel: string | null): string {
  if (!sel || sel.trim() === "*") return "*";
  const cols = new Set(tableColumns(table));
  const out = sel.split(",").map((c) => c.trim()).filter((c) => isIdent(c) && cols.has(c));
  return out.length ? out.join(",") : "*";
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-expose-headers", "content-range, content-profile");
  return new Response(body === null ? "null" : JSON.stringify(body), { ...init, headers });
}

export async function handleRest(req: Request, url: URL): Promise<Response> {
  // Every REST endpoint requires a valid admin session.
  if (req.method !== "OPTIONS" && !verifyAdminSession(req)) {
    return unauthorizedResponse();
  }
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer, range, x-supabase-api-version, x-admin-token",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS, HEAD",
      },
    });
  }

  const parts = url.pathname.split("/").filter(Boolean); // ["rest","v1","<table>"]
  if (parts.length < 3 || parts[0] !== "rest" || parts[1] !== "v1") {
    return jsonResponse({ message: "not found" }, { status: 404 });
  }
  const table = parts[2];
  if (!ALLOWED.has(table)) return jsonResponse({ message: "table not allowed" }, { status: 403 });

  // Mutating methods are forbidden on read-only tables (e.g. audit_log).
  if (READ_ONLY.has(table) && req.method !== "GET" && req.method !== "HEAD") {
    return jsonResponse({ message: `${table} is read-only` }, { status: 403 });
  }

  const prefer = req.headers.get("prefer") ?? "";
  const wantCount = /count=exact/.test(prefer);
  const headOnly = req.method === "HEAD";
  const upsert = /resolution=merge-duplicates/.test(prefer);
  const onConflict = url.searchParams.get("on_conflict");

  if (req.method === "GET" || headOnly) {
    const cols = selectColumns(table, url.searchParams.get("select"));
    const filters = parseFilters(table, url.searchParams);
    const where = whereFromFilters(filters);
    let sql = `SELECT ${cols} FROM ${table}${where.sql}`;
    const order = url.searchParams.get("order");
    if (order) {
      const orders = order.split(",").map((o) => {
        const [col, dir] = o.split(".");
        if (!isIdent(col)) return "";
        return `${col} ${String(dir).toLowerCase() === "desc" ? "DESC" : "ASC"}`;
      }).filter(Boolean).join(",");
      if (orders) sql += " ORDER BY " + orders;
    }
    const limit = Number(url.searchParams.get("limit") ?? 0);
    if (limit > 0) sql += " LIMIT " + Math.floor(limit);

    let total: number | null = null;
    if (wantCount) {
      const cnt = db.query(`SELECT COUNT(*) FROM ${table}${where.sql}`, where.args as any)[0][0] as number;
      total = cnt;
    }

    if (headOnly) {
      return jsonResponse(null, { status: 200, headers: { "content-range": `0-0/${total ?? "*"}` } });
    }

    const colNames = cols === "*" ? tableColumns(table) : cols.split(",");
    const rawRows = db.query(sql, where.args as any).map((r) => {
      const o: Record<string, unknown> = {};
      colNames.forEach((c, i) => { o[c] = r[i]; });
      return decodeRow(table, o);
    });
    const rows = await Promise.all(rawRows.map((r) => decryptRow(table, r)));
    return jsonResponse(rows, { headers: total !== null ? { "content-range": `0-${rows.length - 1}/${total}` } : {} });
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => null);
    const rows: Record<string, unknown>[] = Array.isArray(body) ? body : body ? [body] : [];
    const cols = new Set(tableColumns(table));
    const out: Record<string, unknown>[] = [];
    for (const raw of rows) {
      let row = encodeRow(table, raw);
      row = await encryptRow(table, row);
      if (!row.id && cols.has("id")) row.id = uid();
      // Auto-generate slug for panels (mirror Supabase trigger panels_autogen_slug)
      if (table === "panels" && cols.has("slug") && (!row.slug || String(row.slug).trim() === "")) {
        row.slug = "p" + uid().replace(/-/g, "").slice(0, 10);
      }
      const keys = Object.keys(row).filter((k) => cols.has(k) && isIdent(k));
      const values = keys.map((k) => row[k]);
      const placeholders = keys.map(() => "?").join(",");
      let sql = `INSERT INTO ${table} (${keys.join(",")}) VALUES (${placeholders})`;
      if (upsert && onConflict) {
        const conflictCols = onConflict.split(",").filter(isIdent);
        const updates = keys.filter((k) => !conflictCols.includes(k)).map((k) => `${k}=excluded.${k}`).join(",");
        sql += ` ON CONFLICT(${conflictCols.join(",")}) DO UPDATE SET ${updates || conflictCols[0] + "=" + conflictCols[0]}`;
      }
      try {
        db.query(sql, values as any);
      } catch (e) {
        return jsonResponse({ message: (e as Error).message, code: "23505" }, { status: 409 });
      }
      const id = row.id;
      if (id) {
        const r = db.queryEntries(`SELECT * FROM ${table} WHERE id = ?`, [id as any])[0];
        if (r) {
          const decoded = decodeRow(table, r as Record<string, unknown>);
          out.push(await decryptRow(table, decoded));
        }
      }
    }
    if (/return=representation/.test(prefer)) return jsonResponse(out, { status: 201 });
    return new Response(null, { status: 201, headers: { "access-control-allow-origin": "*" } });
  }

  if (req.method === "PATCH") {
    const body = await req.json().catch(() => ({}));
    const cols = new Set(tableColumns(table));
    let row = encodeRow(table, body as Record<string, unknown>);
    row = await encryptRow(table, row);
    const keys = Object.keys(row).filter((k) => cols.has(k) && isIdent(k));
    if (!keys.length) return jsonResponse([], { status: 200 });
    const filters = parseFilters(table, url.searchParams);
    // Refuse filterless PATCH — would update every row in the table.
    if (!filters.length) return jsonResponse({ message: "PATCH without a filter is not allowed" }, { status: 400 });
    const where = whereFromFilters(filters);
    const set = keys.map((k) => `${k}=?`).join(",");
    db.query(`UPDATE ${table} SET ${set}${where.sql}`, [...keys.map((k) => row[k]), ...where.args] as any);
    if (/return=representation/.test(prefer)) {
      const rawRows = db.queryEntries(`SELECT * FROM ${table}${where.sql}`, where.args as any);
      const decrypted = await Promise.all(
        (rawRows as any[]).map((r) => decryptRow(table, decodeRow(table, r as Record<string, unknown>)))
      );
      return jsonResponse(decrypted);
    }
    return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*" } });
  }

  if (req.method === "DELETE") {
    const filters = parseFilters(table, url.searchParams);
    // Refuse filterless DELETE — would wipe the entire table.
    if (!filters.length) return jsonResponse({ message: "DELETE without a filter is not allowed" }, { status: 400 });
    const where = whereFromFilters(filters);
    db.query(`DELETE FROM ${table}${where.sql}`, where.args as any);
    return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*" } });
  }

  return jsonResponse({ message: "method not allowed" }, { status: 405 });
}