// 3X-UI HTTP client + helpers shared by the panel/sub handlers.
import { db, decodeRow } from "./db.ts";
import { decryptField } from "./crypto.ts";

type PanelRow = { id: string; slug: string; name: string; host?: string; public_host?: string; panel_url: string; username: string; password: string };

const cookieCache = new Map<string, { cookie: string; ts: number; ttl: number }>();
const COOKIE_TTL_BASE_MS = 25 * 60 * 1000; // 25 min base
const COOKIE_TTL_JITTER_MS = 5 * 60 * 1000; // ±5 min random jitter
const panelsCache = { rows: [] as PanelRow[], ts: 0 };
const PANELS_TTL_MS = 30_000;

export function getAllPanels(force = false): PanelRow[] {
  if (!force && Date.now() - panelsCache.ts < PANELS_TTL_MS && panelsCache.rows.length) return panelsCache.rows;
  const rows = db.queryEntries(`SELECT id, slug, name, host, public_host, panel_url, username, password FROM panels ORDER BY created_at ASC`);
  panelsCache.rows = rows.map((r) => decodeRow("panels", r as Record<string, unknown>) as unknown as PanelRow);
  panelsCache.ts = Date.now();
  return panelsCache.rows;
}
export function bustPanelsCache() { panelsCache.ts = 0; }
export function getPanelBySlug(slug: string): PanelRow {
  const p = getAllPanels().find((x) => x.slug === slug);
  if (!p) throw new Error(`Panel ${slug} not found`);
  return p;
}

export function panelCfg(p: PanelRow) {
  return { url: (p.panel_url ?? "").replace(/\/+$/, ""), username: p.username, password: p.password };
}

// Note: for self-signed certs on panel HTTPS, start Deno with:
//   --unsafely-ignore-certificate-errors=<your-panel-host>

export async function rawFetch(url: string, init?: RequestInit) {
  return await fetch(url, init);
}

export async function loginPanel(slug: string): Promise<string> {
  const cached = cookieCache.get(slug);
  if (cached && Date.now() - cached.ts < cached.ttl) return cached.cookie;
  const cfg = panelCfg(getPanelBySlug(slug));
  // Decrypt credentials at use-time — supports both plaintext (legacy) and
  // encrypted values (when MASTER_KEY is configured in .env).
  const username = await decryptField(cfg.username);
  const password = await decryptField(cfg.password);
  const res = await rawFetch(`${cfg.url}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }).toString(),
  });
  if (res.status < 200 || res.status >= 300) {
    const text = await res.text();
    throw new Error(`Login failed [${slug}] ${res.status}: ${text}`);
  }
  await res.text();
  const sc = res.headers.get("set-cookie");
  const cookie = (sc ?? "").split(",").map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ");
  if (!cookie) throw new Error(`No cookie from panel ${slug}`);
  const jitter = Math.floor(Math.random() * COOKIE_TTL_JITTER_MS);
  cookieCache.set(slug, { cookie, ts: Date.now(), ttl: COOKIE_TTL_BASE_MS + jitter });
  return cookie;
}

export async function panelFetch(slug: string, path: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) {
  const cfg = panelCfg(getPanelBySlug(slug));
  let cookie = await loginPanel(slug);
  const doReq = async (ck: string) => {
    const r = await rawFetch(`${cfg.url}${path}`, {
      method: init?.method ?? "GET",
      headers: { ...(init?.headers ?? {}), Cookie: ck, Accept: "application/json" },
      body: init?.body,
    });
    return { status: r.status, body: await r.text() };
  };
  let res = await doReq(cookie);
  if (res.status === 401 || res.status === 403) {
    cookieCache.delete(slug);
    cookie = await loginPanel(slug);
    res = await doReq(cookie);
  }
  return res;
}

export async function listInbounds(slug: string) {
  const res = await panelFetch(slug, "/panel/api/inbounds/list", { method: "GET" });
  const json = JSON.parse(res.body);
  if (!json.success) throw new Error(`list inbounds [${slug}]: ${json.msg}`);
  return json.obj as any[];
}

export async function getClientTrafficsByEmail(slug: string) {
  const inbounds = await listInbounds(slug);
  const out: Record<string, { up: number; down: number; total: number }> = {};
  for (const ib of inbounds) {
    for (const c of (ib.clientStats ?? [])) {
      const up = Number(c.up ?? 0), down = Number(c.down ?? 0);
      const prev = out[c.email] ?? { up: 0, down: 0, total: 0 };
      prev.up += up; prev.down += down; prev.total += up + down;
      out[c.email] = prev;
    }
  }
  return out;
}

export async function getClientExpiryByEmail(slug: string) {
  const inbounds = await listInbounds(slug);
  const out: Record<string, number> = {};
  for (const ib of inbounds) {
    let s: any = {};
    try { s = JSON.parse(ib.settings ?? "{}"); } catch {}
    for (const c of (s.clients ?? [])) {
      const exp = Number(c.expiryTime ?? 0);
      if (!c.email) continue;
      if (exp > (out[c.email] ?? 0)) out[c.email] = exp;
    }
  }
  return out;
}

export async function addClient(slug: string, inboundId: number, c: { id: string; email: string; expiryTime: number; totalGB: number; subId: string; flow?: string }) {
  const settings = JSON.stringify({
    clients: [{ id: c.id, flow: c.flow ?? "", email: c.email, limitIp: 0, totalGB: c.totalGB, expiryTime: c.expiryTime, enable: true, tgId: "", subId: c.subId, reset: 0 }],
  });
  const res = await panelFetch(slug, "/panel/api/inbounds/addClient", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id: String(inboundId), settings }).toString(),
  });
  const json = JSON.parse(res.body);
  if (!json.success) throw new Error(`addClient [${slug}/${inboundId}]: ${json.msg}`);
  return json;
}

export async function addInbound(slug: string, payload: {
  up: number;
  down: number;
  total: number;
  remark: string;
  enable: boolean;
  expiryTime: number;
  listen: string;
  port: number;
  protocol: string;
  settings: string;
  streamSettings: string;
  sniffing: string;
}) {
  const bodyParams = new URLSearchParams(Object.entries(payload).map(([k, v]) => [k, String(v)]));
  const res = await panelFetch(slug, "/panel/api/inbounds/add", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: bodyParams.toString(),
  });
  const json = JSON.parse(res.body);
  if (!json.success) throw new Error(`addInbound [${slug}]: ${json.msg}`);
  return json;
}

export async function updateClient(slug: string, inboundId: number, c: { id: string; email: string; expiryTime: number; totalGB: number; subId: string; flow?: string }) {
  const settings = JSON.stringify({
    clients: [{ id: c.id, flow: c.flow ?? "", email: c.email, limitIp: 0, totalGB: c.totalGB, expiryTime: c.expiryTime, enable: true, tgId: "", subId: c.subId, reset: 0 }],
  });
  const res = await panelFetch(slug, `/panel/api/inbounds/updateClient/${c.id}`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id: String(inboundId), settings }).toString(),
  });
  const json = JSON.parse(res.body);
  if (!json.success) throw new Error(`updateClient [${slug}/${inboundId}]: ${json.msg}`);
  return json;
}

export function uuidv4() { return crypto.randomUUID(); }
export function randomSlug(len = 12) {
  const a = "abcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => a[n % a.length]).join("");
}
export function cleanHost(value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try { return new URL(raw.includes("://") ? raw : `http://${raw}`).hostname; } catch {}
  return raw.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/^\[|\]$/g, "").replace(/:\d+$/, "");
}
export function hostFromUrl(u: string) { return cleanHost(u); }
export function panelConnectionHost(p: PanelRow) { return cleanHost(p.public_host || p.host || hostFromUrl(p.panel_url)); }