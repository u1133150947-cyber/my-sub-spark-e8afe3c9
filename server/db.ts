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
`);

export function uid() { return crypto.randomUUID(); }

// JSON columns that should be parsed on read / stringified on write.
const JSON_COLS: Record<string, string[]> = {
  subscriptions: ["sni_whitelist"],
  subscription_inbounds: ["stream_settings"],
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

export function tableColumns(table: string): string[] {
  const rows = db.queryEntries(`PRAGMA table_info(${table})`);
  return rows.map((r) => r.name as string);
}