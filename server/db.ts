// Lightweight SQLite store used by the self-hosted Deno server.
// Pure WASM driver — no FFI / native deps.
import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";

const DB_PATH = Deno.env.get("DB_PATH") ?? "./data/app.db";
try { Deno.mkdirSync("./data", { recursive: true }); } catch {}

export const db = new DB(DB_PATH);

db.execute(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS panels (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE,
  name TEXT NOT NULL,
  host TEXT NOT NULL DEFAULT '',
  public_host TEXT NOT NULL DEFAULT '',
  panel_url TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT 'cascade_yandex',
  readiness TEXT NOT NULL DEFAULT 'auto',
  ssh_user TEXT NOT NULL DEFAULT 'root',
  ssh_port INTEGER NOT NULL DEFAULT 22,
  ssh_auth_type TEXT NOT NULL DEFAULT 'password',
  ssh_password TEXT NOT NULL DEFAULT '',
  ssh_key_passphrase TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unknown',
  status_message TEXT NOT NULL DEFAULT '',
  last_checked_at TEXT,
  country TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_uuid TEXT NOT NULL,
  expiry_ms INTEGER NOT NULL DEFAULT 0,
  total_bytes INTEGER NOT NULL DEFAULT 0,
  hits INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TEXT,
  raw_links TEXT NOT NULL DEFAULT '[]',
  sni_whitelist TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscription_inbounds (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  panel TEXT NOT NULL,
  inbound_id INTEGER NOT NULL,
  remark TEXT NOT NULL,
  protocol TEXT NOT NULL,
  port INTEGER NOT NULL,
  host TEXT NOT NULL,
  stream_settings TEXT NOT NULL DEFAULT '{}',
  client_email TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_si_sub ON subscription_inbounds(subscription_id);
CREATE INDEX IF NOT EXISTS idx_si_panel ON subscription_inbounds(panel);

CREATE TABLE IF NOT EXISTS inbound_overrides (
  id TEXT PRIMARY KEY,
  panel TEXT NOT NULL,
  inbound_id INTEGER NOT NULL,
  display_remark TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(panel, inbound_id)
);

CREATE TABLE IF NOT EXISTS client_mappings (
  id TEXT PRIMARY KEY,
  panel TEXT NOT NULL,
  client_email TEXT NOT NULL,
  subscription_id TEXT,
  label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(panel, client_email)
);

CREATE TABLE IF NOT EXISTS traffic_snapshots (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  used_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ts_created ON traffic_snapshots(created_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  level TEXT NOT NULL DEFAULT 'info',
  action TEXT NOT NULL,
  panel_slug TEXT,
  subscription_id TEXT,
  status TEXT,
  duration_ms INTEGER,
  error TEXT,
  request_id TEXT,
  meta TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts);
CREATE INDEX IF NOT EXISTS idx_audit_level ON audit_log(level);

CREATE TABLE IF NOT EXISTS external_subs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🌐',
  source_url TEXT NOT NULL DEFAULT '',
  raw_links TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 1000,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscription_external_subs (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  external_sub_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1000,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(subscription_id, external_sub_id)
);
CREATE INDEX IF NOT EXISTS idx_ses_sub ON subscription_external_subs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_ses_ext ON subscription_external_subs(external_sub_id);

CREATE TABLE IF NOT EXISTS admin_login_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_login_codes_hash ON admin_login_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_admin_login_codes_created ON admin_login_codes(created_at);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token);

CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// ─── Migrations for legacy databases ────────────────────────────────────────────
// "Expected" errors (duplicate column, constraint that already exists) are silently
// ignored. Anything unexpected is logged as a warning so it's visible but doesn't
// crash the server — the schema state is the source of truth, not migration success.
const EXPECTED_MIGRATION_ERRORS = [
  /duplicate column name/i,
  /already exists/i,
  /table.*already exists/i,
];

// ─── Migration version table ───────────────────────────────────────────────────
// Tracks every migration that has been applied so we can skip already-run ones,
// surface a clean audit trail in `_migrations`, and detect repeated failures.
db.execute(`
  CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now')),
    duration_ms INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ok'
  );
`);

function isMigrationApplied(name: string): boolean {
  const r = db.queryEntries(`SELECT name FROM _migrations WHERE name = ? LIMIT 1`, [name]);
  return r.length > 0;
}

function recordMigration(name: string, ms: number, status: "ok" | "skipped" | "error") {
  db.query(
    `INSERT INTO _migrations (name, applied_at, duration_ms, status)
     VALUES (?, datetime('now'), ?, ?)
     ON CONFLICT(name) DO UPDATE SET applied_at = excluded.applied_at,
                                     duration_ms = excluded.duration_ms,
                                     status = excluded.status`,
    [name, Math.round(ms), status],
  );
}

function migrate(name: string, fn: () => void) {
  if (isMigrationApplied(name)) return; // already done — skip silently
  const t0 = performance.now();
  try {
    fn();
    recordMigration(name, performance.now() - t0, "ok");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isExpected = EXPECTED_MIGRATION_ERRORS.some((re) => re.test(msg));
    if (isExpected) {
      // Migration was effectively a no-op (column/table already there) — record it as applied.
      recordMigration(name, performance.now() - t0, "skipped");
    } else {
      console.warn(`[migration] UNEXPECTED ERROR in "${name}": ${msg}`);
      recordMigration(name, performance.now() - t0, "error");
    }
  }
}

function colsOf(table: string): string[] {
  return db.queryEntries(`PRAGMA table_info(${table})`).map((r: any) => r.name as string);
}

migrate("panels.country", () => {
  if (!colsOf("panels").includes("country")) {
    db.execute(`ALTER TABLE panels ADD COLUMN country TEXT NOT NULL DEFAULT ''`);
    console.log("[migration] panels.country added");
  }
});
migrate("subscription_inbounds.sort_order", () => {
  if (!colsOf("subscription_inbounds").includes("sort_order")) {
    db.execute(`ALTER TABLE subscription_inbounds ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);
    console.log("[migration] subscription_inbounds.sort_order added");
  }
});
migrate("subscription_external_subs.sort_order", () => {
  if (!colsOf("subscription_external_subs").includes("sort_order")) {
    db.execute(`ALTER TABLE subscription_external_subs ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 1000`);
    console.log("[migration] subscription_external_subs.sort_order added");
  }
});
migrate("external_subs.sort_order", () => {
  if (!colsOf("external_subs").includes("sort_order")) {
    db.execute(`ALTER TABLE external_subs ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 1000`);
    console.log("[migration] external_subs.sort_order added");
  }
});
migrate("subscriptions.raw_links", () => {
  if (!colsOf("subscriptions").includes("raw_links")) {
    db.execute(`ALTER TABLE subscriptions ADD COLUMN raw_links TEXT NOT NULL DEFAULT '[]'`);
    console.log("[migration] subscriptions.raw_links added");
  }
});
migrate("admin_login_codes.failed_attempts", () => {
  if (!colsOf("admin_login_codes").includes("failed_attempts")) {
    db.execute(`ALTER TABLE admin_login_codes ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0`);
    console.log("[migration] admin_login_codes.failed_attempts added");
  }
});
migrate("panels.slug backfill", () => {
  const broken = db.queryEntries(`SELECT id FROM panels WHERE slug IS NULL OR slug = ''`);
  for (const r of broken) {
    const slug = "p" + crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    db.query(`UPDATE panels SET slug = ? WHERE id = ?`, [slug, (r as any).id]);
  }
});

// Migrate subscription_inbounds to add ON DELETE CASCADE on subscription_id.
// SQLite doesn't support ALTER COLUMN, so we recreate the table if the FK is missing.
migrate("subscription_inbounds.cascade_fk", () => {
  // Check if FK already present by inspecting CREATE TABLE sql.
  const row = db.queryEntries(`SELECT sql FROM sqlite_master WHERE type='table' AND name='subscription_inbounds'`)[0] as any;
  if (!row?.sql || String(row.sql).toLowerCase().includes("on delete cascade")) return;
  db.execute(`
    CREATE TABLE IF NOT EXISTS subscription_inbounds_new (
      id TEXT PRIMARY KEY,
      subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
      panel TEXT NOT NULL,
      inbound_id INTEGER NOT NULL,
      remark TEXT NOT NULL,
      protocol TEXT NOT NULL,
      port INTEGER NOT NULL,
      host TEXT NOT NULL,
      stream_settings TEXT NOT NULL DEFAULT '{}',
      client_email TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO subscription_inbounds_new SELECT * FROM subscription_inbounds;
    DROP TABLE subscription_inbounds;
    ALTER TABLE subscription_inbounds_new RENAME TO subscription_inbounds;
    CREATE INDEX IF NOT EXISTS idx_si_sub ON subscription_inbounds(subscription_id);
    CREATE INDEX IF NOT EXISTS idx_si_panel ON subscription_inbounds(panel);
  `);
  console.log("[migration] subscription_inbounds rebuilt with ON DELETE CASCADE");
});

// Same for subscription_external_subs.
migrate("subscription_external_subs.cascade_fk", () => {
  const row = db.queryEntries(`SELECT sql FROM sqlite_master WHERE type='table' AND name='subscription_external_subs'`)[0] as any;
  if (!row?.sql || String(row.sql).toLowerCase().includes("on delete cascade")) return;
  db.execute(`
    CREATE TABLE IF NOT EXISTS subscription_external_subs_new (
      id TEXT PRIMARY KEY,
      subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
      external_sub_id TEXT NOT NULL REFERENCES external_subs(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO subscription_external_subs_new SELECT * FROM subscription_external_subs;
    DROP TABLE subscription_external_subs;
    ALTER TABLE subscription_external_subs_new RENAME TO subscription_external_subs;
    CREATE INDEX IF NOT EXISTS idx_ses_sub ON subscription_external_subs(subscription_id);
    CREATE INDEX IF NOT EXISTS idx_ses_ext ON subscription_external_subs(external_sub_id);
  `);
  console.log("[migration] subscription_external_subs rebuilt with ON DELETE CASCADE");
});

// ─── Column cache ─────────────────────────────────────────────────────────────
// PRAGMA table_info is fast but not free — schema never changes at runtime, so cache it.
const _colCache = new Map<string, string[]>();

export function tableColumns(table: string): string[] {
  const cached = _colCache.get(table);
  if (cached) return cached;
  const result = db.queryEntries(`PRAGMA table_info(${table})`).map((r: any) => r.name as string);
  _colCache.set(table, result);
  return result;
}

export function invalidateColCache(table?: string) {
  if (table) _colCache.delete(table);
  else _colCache.clear();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function uid() { return crypto.randomUUID(); }

const JSON_COLS: Record<string, string[]> = {
  subscriptions: ["sni_whitelist", "raw_links"],
  subscription_inbounds: ["stream_settings"],
  external_subs: ["raw_links"],
};

export function decodeRow(table: string, row: Record<string, unknown>) {
  const cols = JSON_COLS[table] ?? [];
  for (const c of cols) {
    const v = row[c];
    if (typeof v === "string") {
      try { row[c] = JSON.parse(v); } catch { /* keep raw */ }
    }
  }
  return row;
}

export function encodeRow(table: string, row: Record<string, unknown>) {
  const cols = JSON_COLS[table] ?? [];
  const out = { ...row };
  for (const c of cols) {
    if (out[c] !== undefined && typeof out[c] !== "string") {
      out[c] = JSON.stringify(out[c]);
    }
  }
  return out;
}

export function rowsAsObjects(table: string, columns: string[], rows: unknown[][]) {
  return rows.map((r) => {
    const o: Record<string, unknown> = {};
    columns.forEach((c, i) => { o[c] = r[i]; });
    return decodeRow(table, o);
  });
}
