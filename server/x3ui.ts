// 3X-UI HTTP client + helpers shared by the panel/sub handlers.
import { db, decodeRow } from "./db.ts";
import { decryptField } from "./crypto.ts";

type PanelRow = { id: string; slug: string; name: string; host?: string; public_host?: string; panel_url: string; username: string; password: string };

const cookieCache = new Map<string, { cookie: string; csrf: string; ts: number; ttl: number }>();
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

export async function testPanelConnection(panelUrl: string, usernameValue: string, passwordValue: string) {
  const url = panelUrl.replace(/\/+$/, "");
  const username = await decryptField(usernameValue);
  const password = await decryptField(passwordValue);
  const loginPage = await rawFetch(`${url}/`, { headers: { Accept: "text/html" } });
  const loginHtml = await loginPage.text();
  const csrf = loginHtml.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i)?.[1] ?? "";
  const preCookie = (loginPage.headers.get("set-cookie") ?? "")
    .split(",")
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
  const res = await rawFetch(`${url}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...(preCookie ? { Cookie: preCookie } : {}),
    },
    body: JSON.stringify({ username, password, twoFactorCode: "" }),
  });
  const text = await res.text();
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  let parsed: any = null; try { parsed = JSON.parse(text); } catch {}
  if (parsed && parsed.success === false) throw new Error(parsed.msg ?? "Login refused");
  const cookie = res.headers.get("set-cookie") || preCookie;
  if (!cookie && !(parsed && parsed.success)) throw new Error("Панель не вернула сессию");
  return true;
}

export async function loginPanel(slug: string): Promise<{ cookie: string; csrf: string }> {
  const cached = cookieCache.get(slug);
  if (cached && Date.now() - cached.ts < cached.ttl) return { cookie: cached.cookie, csrf: cached.csrf };
  const cfg = panelCfg(getPanelBySlug(slug));
  // Decrypt credentials at use-time — supports both plaintext (legacy) and
  // encrypted values (when MASTER_KEY is configured in .env).
  const username = await decryptField(cfg.username);
  const password = await decryptField(cfg.password);
  const loginPage = await rawFetch(`${cfg.url}/`, { headers: { Accept: "text/html" } });
  const loginHtml = await loginPage.text();
  const csrf = loginHtml.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i)?.[1] ?? "";
  const preCookie = (loginPage.headers.get("set-cookie") ?? "")
    .split(",")
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
  const res = await rawFetch(`${cfg.url}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...(preCookie ? { Cookie: preCookie } : {}),
    },
    body: JSON.stringify({ username, password, twoFactorCode: "" }),
  });
  if (res.status < 200 || res.status >= 300) {
    const text = await res.text();
    throw new Error(`Login failed [${slug}] ${res.status}: ${text}`);
  }
  await res.text();
  const sc = res.headers.get("set-cookie");
  const cookie = (sc ?? "").split(",").map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ");
  if (!cookie && !preCookie) throw new Error(`No cookie from panel ${slug}`);
  const jitter = Math.floor(Math.random() * COOKIE_TTL_JITTER_MS);
  cookieCache.set(slug, { cookie: cookie || preCookie, csrf, ts: Date.now(), ttl: COOKIE_TTL_BASE_MS + jitter });
  return { cookie: cookie || preCookie, csrf };
}

export async function panelFetch(slug: string, path: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) {
  const cfg = panelCfg(getPanelBySlug(slug));
  let session = await loginPanel(slug);
  const doReq = async (sess: { cookie: string; csrf: string }) => {
    const headers: Record<string, string> = { ...(init?.headers ?? {}), Cookie: sess.cookie, Accept: "application/json" };
    if (init?.method && init.method !== "GET" && sess.csrf) {
      headers["X-CSRF-Token"] = sess.csrf;
    }
    const r = await rawFetch(`${cfg.url}${path}`, {
      method: init?.method ?? "GET",
      headers,
      body: init?.body,
    });
    return { status: r.status, body: await r.text() };
  };
  let res = await doReq(session);
  if (res.status === 401 || res.status === 403) {
    cookieCache.delete(slug);
    session = await loginPanel(slug);
    res = await doReq(session);
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

export async function addClient(slug: string, inboundId: number, c: { id: string; email: string; expiryTime: number; totalGB: number; subId: string; flow?: string }, protocol: string = "vless") {
  const proto = protocol.toLowerCase();
  const isPass = ["trojan", "shadowsocks", "hysteria", "hysteria2", "hy2"].includes(proto);
  const clientObj: any = { flow: c.flow ?? "", email: c.email, limitIp: 0, totalGB: c.totalGB, expiryTime: c.expiryTime, enable: true, tgId: "", subId: c.subId, reset: 0 };
  clientObj.id = c.id; // always include id to satisfy API checks
  if (isPass) clientObj.password = c.id;

  if (proto === "hysteria2" || proto === "hy2") {
    const list = await listInbounds(slug);
    const ib = list.find(x => x.id === inboundId);
    if (!ib) throw new Error("inbound not found");
    let s: any = {}; try { s = JSON.parse(ib.settings); } catch {}
    const clients = Array.isArray(s.clients) ? s.clients : [];
    const idx = clients.findIndex((x: any) => x.email === c.email || x.id === c.id || x.password === c.id);
    if (idx >= 0) clients[idx] = clientObj; else clients.push(clientObj);
    s.clients = clients;
    return await updateInbound(slug, inboundId, { ...ib, settings: JSON.stringify(s) });
  }

  const settings = JSON.stringify({
    clients: [clientObj],
  });
  const res = await panelFetch(slug, "/panel/api/inbounds/addClient", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id: String(inboundId), settings }).toString(),
  });
  const json = JSON.parse(res.body);
  if (!json.success) throw new Error(`addClient [${slug}/${inboundId}]: ${json.msg}`);
  return json;
}

export async function updateInbound(slug: string, id: number, ib: any) {
  const cleanPayload: Record<string, string> = {
    up: String(Number(ib.up ?? 0)),
    down: String(Number(ib.down ?? 0)),
    total: String(Number(ib.total ?? 0)),
    remark: String(ib.remark ?? ""),
    enable: String(ib.enable !== false),
    expiryTime: String(Number(ib.expiryTime ?? 0)),
    listen: String(ib.listen ?? ""),
    port: String(Number(ib.port ?? 0)),
    protocol: String(ib.protocol ?? ""),
    settings: typeof ib.settings === "string" ? ib.settings : JSON.stringify(ib.settings ?? {}),
    streamSettings: typeof ib.streamSettings === "string" ? ib.streamSettings : JSON.stringify(ib.streamSettings ?? {}),
    sniffing: typeof ib.sniffing === "string" ? ib.sniffing : JSON.stringify(ib.sniffing ?? { enabled: false, destOverride: [] }),
  };
  const payload = new URLSearchParams(Object.entries(cleanPayload));
  const res = await panelFetch(slug, `/panel/api/inbounds/update/${id}`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload.toString(),
  });
  const json = JSON.parse(res.body);
  if (!json.success) throw new Error(`updateInbound [${slug}/${id}]: ${json.msg}`);
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

export async function updateClient(slug: string, inboundId: number, c: { id: string; email: string; expiryTime: number; totalGB: number; subId: string; flow?: string }, protocol: string = "vless") {
  const proto = protocol.toLowerCase();
  const isPass = ["trojan", "shadowsocks", "hysteria", "hysteria2", "hy2"].includes(proto);
  const clientObj: any = { flow: c.flow ?? "", email: c.email, limitIp: 0, totalGB: c.totalGB, expiryTime: c.expiryTime, enable: true, tgId: "", subId: c.subId, reset: 0 };
  clientObj.id = c.id;
  if (isPass) clientObj.password = c.id;

  if (proto === "hysteria2" || proto === "hy2") {
    const list = await listInbounds(slug);
    const ib = list.find(x => x.id === inboundId);
    if (!ib) throw new Error("inbound not found");
    let s: any = {}; try { s = JSON.parse(ib.settings); } catch {}
    const clients = s.clients || [];
    const idx = clients.findIndex((x: any) => x.email === c.email || x.id === c.id || x.password === c.id);
    if (idx >= 0) clients[idx] = clientObj; else clients.push(clientObj);
    s.clients = clients;
    return await updateInbound(slug, inboundId, { ...ib, settings: JSON.stringify(s) });
  }

  const settings = JSON.stringify({
    clients: [clientObj],
  });
  const res = await panelFetch(slug, `/panel/api/inbounds/updateClient/${c.id}`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id: String(inboundId), settings }).toString(),
  });
  const json = JSON.parse(res.body);
  if (!json.success) throw new Error(`updateClient [${slug}/${inboundId}]: ${json.msg}`);
  return json;
}

export async function deleteClient(slug: string, inboundId: number, clientUuid: string, protocol: string = "vless") {
  const proto = protocol.toLowerCase();
  if (proto === "hysteria2" || proto === "hy2") {
    const list = await listInbounds(slug);
    const ib = list.find((x: any) => x.id === inboundId);
    if (!ib) throw new Error("inbound not found");
    let s: any = {}; try { s = JSON.parse(ib.settings); } catch {}
    const clients = Array.isArray(s.clients) ? s.clients : [];
    s.clients = clients.filter((x: any) => x.id !== clientUuid && x.password !== clientUuid);
    return await updateInbound(slug, inboundId, { ...ib, settings: JSON.stringify(s) });
  }
  const r = await panelFetch(slug, `/panel/api/inbounds/${inboundId}/delClient/${clientUuid}`, { method: "POST" });
  let j: any = {}; try { j = JSON.parse(r.body); } catch {}
  if (!j.success) throw new Error(j.msg ?? `deleteClient [${slug}/${inboundId}] failed`);
  return j;
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