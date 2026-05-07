import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import https from "node:https";
import http from "node:http";
import { Buffer } from "node:buffer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type PanelRow = { id: string; slug: string; name: string; panel_url: string; username: string; password: string };
type PanelKey = string;

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// in-memory caches per cold-start
const panelsCache = { rows: [] as PanelRow[], ts: 0 };
const PANELS_CACHE_TTL_MS = 30_000;
const cookieCache = new Map<PanelKey, { cookie: string; ts: number }>();
const COOKIE_TTL_MS = 30 * 60 * 1000;

async function getAllPanels(): Promise<PanelRow[]> {
  if (Date.now() - panelsCache.ts < PANELS_CACHE_TTL_MS && panelsCache.rows.length) return panelsCache.rows;
  const { data, error } = await supabaseAdmin
    .from("panels")
    .select("id, slug, name, panel_url, username, password")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`load panels: ${error.message}`);
  panelsCache.rows = (data ?? []) as PanelRow[];
  panelsCache.ts = Date.now();
  return panelsCache.rows;
}

async function getPanelBySlug(slug: PanelKey): Promise<PanelRow> {
  const all = await getAllPanels();
  const p = all.find((x) => x.slug === slug);
  if (!p) throw new Error(`Panel ${slug} not found`);
  return p;
}

function panelCfg(p: PanelRow) {
  return { url: (p.panel_url ?? "").replace(/\/+$/, ""), username: p.username, password: p.password };
}

function nodeRequest(
  urlStr: string,
  opts: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<{ status: number; headers: Record<string, string | string[]>; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const isHttps = u.protocol === "https:";
    const lib: any = isHttps ? https : http;
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: u.pathname + u.search,
        method: opts.method ?? "GET",
        headers: opts.headers ?? {},
        rejectUnauthorized: false,
      },
      (res: any) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function loginPanel(slug: PanelKey): Promise<string> {
  const cached = cookieCache.get(slug);
  if (cached && Date.now() - cached.ts < COOKIE_TTL_MS) return cached.cookie;
  const cfg = panelCfg(await getPanelBySlug(slug));
  const res = await nodeRequest(`${cfg.url}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: cfg.username, password: cfg.password }).toString(),
  });
  if (res.status < 200 || res.status >= 300) throw new Error(`Login failed [${slug}] ${res.status}: ${res.body}`);
  const sc = res.headers["set-cookie"];
  const setCookies: string[] = Array.isArray(sc) ? sc : sc ? [sc as string] : [];
  const cookie = setCookies.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
  if (!cookie) throw new Error(`No cookie from panel ${slug}`);
  cookieCache.set(slug, { cookie, ts: Date.now() });
  return cookie;
}

async function panelFetch(
  slug: PanelKey,
  path: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) {
  const cfg = panelCfg(await getPanelBySlug(slug));
  let cookie = await loginPanel(slug);
  const doReq = (ck: string) =>
    nodeRequest(`${cfg.url}${path}`, {
      method: init?.method ?? "GET",
      headers: { ...(init?.headers ?? {}), Cookie: ck, Accept: "application/json" },
      body: init?.body,
    });
  let res = await doReq(cookie);
  if (res.status === 401 || res.status === 403) {
    cookieCache.delete(slug);
    cookie = await loginPanel(slug);
    res = await doReq(cookie);
  }
  return res;
}

async function listInbounds(slug: PanelKey) {
  const res = await panelFetch(slug, "/panel/api/inbounds/list", { method: "GET" });
  const json = JSON.parse(res.body);
  if (!json.success) throw new Error(`list inbounds [${slug}]: ${json.msg}`);
  return json.obj as any[];
}

async function getClientTrafficsByEmail(slug: PanelKey): Promise<Record<string, { up: number; down: number; total: number }>> {
  const inbounds = await listInbounds(slug);
  const out: Record<string, { up: number; down: number; total: number }> = {};
  for (const ib of inbounds) {
    const stats: any[] = ib.clientStats ?? [];
    for (const c of stats) {
      const up = Number(c.up ?? 0);
      const down = Number(c.down ?? 0);
      const prev = out[c.email] ?? { up: 0, down: 0, total: 0 };
      prev.up += up;
      prev.down += down;
      prev.total += up + down;
      out[c.email] = prev;
    }
  }
  return out;
}

// Read expiryTime (ms) per client email from inbound settings across all inbounds of a panel.
async function getClientExpiryByEmail(slug: PanelKey): Promise<Record<string, number>> {
  const inbounds = await listInbounds(slug);
  const out: Record<string, number> = {};
  for (const ib of inbounds) {
    let s: any = {};
    try { s = JSON.parse(ib.settings ?? "{}"); } catch {}
    for (const c of (s.clients ?? [])) {
      const exp = Number(c.expiryTime ?? 0);
      if (!c.email) continue;
      // keep the largest expiry seen for the email
      if (exp > (out[c.email] ?? 0)) out[c.email] = exp;
    }
  }
  return out;
}

async function addClient(
  slug: PanelKey,
  inboundId: number,
  client: { id: string; email: string; expiryTime: number; totalGB: number; subId: string; flow?: string },
) {
  const settings = JSON.stringify({
    clients: [{ id: client.id, flow: client.flow ?? "", email: client.email, limitIp: 0, totalGB: client.totalGB, expiryTime: client.expiryTime, enable: true, tgId: "", subId: client.subId, reset: 0 }],
  });
  const res = await panelFetch(slug, "/panel/api/inbounds/addClient", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: inboundId, settings }),
  });
  const json = JSON.parse(res.body);
  if (!json.success) throw new Error(`addClient [${slug}/${inboundId}]: ${json.msg}`);
  return json;
}

async function updateClient(
  slug: PanelKey,
  inboundId: number,
  client: { id: string; email: string; expiryTime: number; totalGB: number; subId: string; flow?: string },
) {
  const settings = JSON.stringify({
    clients: [{ id: client.id, flow: client.flow ?? "", email: client.email, limitIp: 0, totalGB: client.totalGB, expiryTime: client.expiryTime, enable: true, tgId: "", subId: client.subId, reset: 0 }],
  });
  const res = await panelFetch(slug, `/panel/api/inbounds/updateClient/${client.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: inboundId, settings }),
  });
  const json = JSON.parse(res.body);
  if (!json.success) throw new Error(`updateClient [${slug}/${inboundId}]: ${json.msg}`);
  return json;
}

function uuidv4() { return crypto.randomUUID(); }
function randomSlug(len = 12) {
  const a = "abcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => a[n % a.length]).join("");
}
function hostFromUrl(u: string) { try { return new URL(u).hostname; } catch { return u; } }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = supabaseAdmin;

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "";

    if (action === "testPanel") {
      const body = await req.json().catch(() => ({}));
      const panelUrl: string = (body.panel_url ?? "").replace(/\/+$/, "");
      const username: string = body.username ?? "";
      const password: string = body.password ?? "";
      if (!panelUrl || !username || !password) {
        return new Response(JSON.stringify({ ok: false, error: "panel_url, username, password обязательны" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      try {
        const res = await nodeRequest(`${panelUrl}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ username, password }).toString(),
        });
        if (res.status < 200 || res.status >= 300) {
          return new Response(JSON.stringify({ ok: false, error: `HTTP ${res.status}: ${res.body.slice(0, 200)}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        let parsed: any = null;
        try { parsed = JSON.parse(res.body); } catch {}
        if (parsed && parsed.success === false) {
          return new Response(JSON.stringify({ ok: false, error: parsed.msg ?? "Login refused" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const sc = res.headers["set-cookie"];
        const hasCookie = Array.isArray(sc) ? sc.length > 0 : !!sc;
        if (!hasCookie && !(parsed && parsed.success)) {
          return new Response(JSON.stringify({ ok: false, error: "Панель не вернула сессию" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e: any) {
        return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (action === "inbounds") {
      const all = await getAllPanels();
      const result: Record<string, any> = {};
      const meta = all.map((p) => ({ slug: p.slug, name: p.name }));
      await Promise.all(all.map(async (p) => {
        try {
          const inbounds = await listInbounds(p.slug);
          result[p.slug] = inbounds.map((ib) => {
            let clients: { email: string; id?: string; enable?: boolean }[] = [];
            try {
              const s = JSON.parse(ib.settings ?? "{}");
              clients = (s.clients ?? []).map((c: any) => ({ email: c.email, id: c.id, enable: c.enable !== false }));
            } catch {}
            return { id: ib.id, remark: ib.remark, protocol: ib.protocol, port: ib.port, enable: ib.enable, clients };
          });
        } catch (e) {
          result[p.slug] = { error: e instanceof Error ? e.message : String(e) };
        }
      }));
      return new Response(JSON.stringify({ ...result, _panels: meta }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "onlines") {
      const all = await getAllPanels();
      const result: { panel: string; email: string; subscription_id: string | null; sub_name: string | null; remark: string | null }[] = [];
      const errors: Record<string, string> = {};

      const { data: links } = await supabase.from("subscription_inbounds").select("client_email, subscription_id, remark, panel, inbound_id");
      const { data: subsRows } = await supabase.from("subscriptions").select("id, name, client_email");
      const { data: mappings } = await supabase.from("client_mappings").select("panel, client_email, subscription_id, label");
      const emailToInfo = new Map<string, { sid: string; name: string; remark: string | null }>();
      (links ?? []).forEach((l: any) => {
        const sub = (subsRows ?? []).find((s: any) => s.id === l.subscription_id);
        emailToInfo.set(l.client_email, { sid: l.subscription_id, name: sub?.name ?? "?", remark: l.remark });
      });
      const mapByPanelEmail = new Map<string, { sid: string | null; name: string | null }>();
      (mappings ?? []).forEach((m: any) => {
        const sub = (subsRows ?? []).find((s: any) => s.id === m.subscription_id);
        mapByPanelEmail.set(`${m.panel}::${m.client_email}`, { sid: m.subscription_id, name: sub?.name ?? m.label ?? null });
      });

      await Promise.all(all.map(async (p) => {
        try {
          const res = await panelFetch(p.slug, "/panel/api/inbounds/onlines", { method: "POST" });
          const j = JSON.parse(res.body);
          if (!j.success) { errors[p.slug] = j.msg ?? "error"; return; }
          const emails: string[] = j.obj ?? [];
          for (const email of emails) {
            const info = emailToInfo.get(email);
            const manual = mapByPanelEmail.get(`${p.slug}::${email}`);
            result.push({ panel: p.slug, email, subscription_id: info?.sid ?? manual?.sid ?? null, sub_name: info?.name ?? manual?.name ?? null, remark: info?.remark ?? null });
          }
        } catch (e) {
          errors[p.slug] = e instanceof Error ? e.message : String(e);
        }
      }));
      return new Response(JSON.stringify({ onlines: result, errors }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "bulkAddInbound" && req.method === "POST") {
      const body = await req.json();
      const panel: PanelKey = body.panel;
      const inboundId: number = Number(body.inboundId);
      if (!panel || !inboundId) {
        return new Response(JSON.stringify({ error: "panel, inboundId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: allSubs } = await supabase.from("subscriptions").select("id, slug, client_uuid, client_email, expiry_ms, total_bytes");
      const { data: existing } = await supabase.from("subscription_inbounds").select("subscription_id").eq("panel", panel).eq("inbound_id", inboundId);
      const have = new Set((existing ?? []).map((l: any) => l.subscription_id));

      const cfg = panelCfg(await getPanelBySlug(panel));
      const inboundsList = await listInbounds(panel);
      const ib = inboundsList.find((x: any) => x.id === inboundId);
      if (!ib) return new Response(JSON.stringify({ error: "inbound not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      let stream: any = {};
      try { stream = JSON.parse(ib.streamSettings); } catch {}
      const flow = ib.protocol === "vless" && stream.security === "reality" ? "xtls-rprx-vision" : "";

      const created: any[] = [];
      const errors: any[] = [];
      const targets = (allSubs ?? []).filter((s) => !have.has(s.id));
      await Promise.all(targets.map(async (sub) => {
        try {
          const email = `${sub.client_email}_${panel}${ib.id}`;
          await addClient(panel, inboundId, { id: sub.client_uuid, email, expiryTime: sub.expiry_ms, totalGB: sub.total_bytes, subId: sub.slug.slice(0, 16), flow });
          await supabase.from("subscription_inbounds").insert({
            subscription_id: sub.id, panel, inbound_id: ib.id,
            remark: ib.remark ?? `${panel}-${ib.id}`, protocol: ib.protocol, port: ib.port,
            host: hostFromUrl(cfg.url), stream_settings: stream, client_email: email,
          });
          created.push(sub.id);
        } catch (e) {
          errors.push({ sub: sub.id, error: e instanceof Error ? e.message : String(e) });
        }
      }));
      return new Response(JSON.stringify({ created: created.length, errors }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "bulkRemoveInbound" && req.method === "POST") {
      const body = await req.json();
      const panel: PanelKey = body.panel;
      const inboundId: number = Number(body.inboundId);
      if (!panel || !inboundId) {
        return new Response(JSON.stringify({ error: "panel, inboundId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: links } = await supabase.from("subscription_inbounds").select("subscription_id").eq("panel", panel).eq("inbound_id", inboundId);
      const subIds = (links ?? []).map((l: any) => l.subscription_id);
      if (!subIds.length) {
        return new Response(JSON.stringify({ removed: 0, errors: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: subs } = await supabase.from("subscriptions").select("id, client_uuid").in("id", subIds);
      const errors: any[] = [];
      let removed = 0;
      await Promise.all((subs ?? []).map(async (s) => {
        try {
          await panelFetch(panel, `/panel/api/inbounds/${inboundId}/delClient/${s.client_uuid}`, { method: "POST" });
          removed++;
        } catch (e) {
          errors.push({ sub: s.id, error: e instanceof Error ? e.message : String(e) });
        }
      }));
      await supabase.from("subscription_inbounds").delete().eq("panel", panel).eq("inbound_id", inboundId);
      return new Response(JSON.stringify({ removed, errors }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "syncExpiry") {
      const all = await getAllPanels();
      const { data: subs } = await supabase.from("subscriptions").select("id, client_email, expiry_ms");
      const { data: links } = await supabase.from("subscription_inbounds").select("subscription_id, client_email");
      const emailToSub = new Map<string, string>();
      (links ?? []).forEach((l: any) => { if (l.client_email) emailToSub.set(l.client_email, l.subscription_id); });
      (subs ?? []).forEach((s: any) => { if (s.client_email && !emailToSub.has(s.client_email)) emailToSub.set(s.client_email, s.id); });

      const subToExpiry = new Map<string, number>();
      const errors: Record<string, string> = {};
      await Promise.all(all.map(async (p) => {
        try {
          const m = await getClientExpiryByEmail(p.slug);
          for (const [email, exp] of Object.entries(m)) {
            const sid = emailToSub.get(email);
            if (!sid) continue;
            const cur = subToExpiry.get(sid) ?? 0;
            if (exp > 0 && (cur === 0 || exp > cur)) subToExpiry.set(sid, exp);
            else if (cur === 0 && exp === 0) subToExpiry.set(sid, 0);
          }
        } catch (e) {
          errors[p.slug] = e instanceof Error ? e.message : String(e);
        }
      }));

      let updated = 0;
      for (const s of subs ?? []) {
        const newExp = subToExpiry.get(s.id);
        if (newExp === undefined) continue;
        if (Number(s.expiry_ms ?? 0) === newExp) continue;
        const { error: uErr } = await supabase.from("subscriptions").update({ expiry_ms: newExp }).eq("id", s.id);
        if (!uErr) updated++;
      }
      return new Response(JSON.stringify({ updated, total: subs?.length ?? 0, errors }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "stats") {
      const all = await getAllPanels();
      const { data: subs } = await supabase.from("subscriptions").select("id, name, client_email, created_at");

      const usagePerSub = new Map<string, { up: number; down: number; total: number }>();
      const panelErrors: Record<string, string> = {};
      const { data: allLinks } = await supabase.from("subscription_inbounds").select("subscription_id, client_email");
      const emailToSub = new Map<string, string>();
      (allLinks ?? []).forEach((l: any) => { if (l.client_email) emailToSub.set(l.client_email, l.subscription_id); });
      (subs ?? []).forEach((s) => { if (!emailToSub.has(s.client_email)) emailToSub.set(s.client_email, s.id); });
      await Promise.all(all.map(async (p) => {
        try {
          const m = await getClientTrafficsByEmail(p.slug);
          for (const [email, v] of Object.entries(m)) {
            const sid = emailToSub.get(email);
            if (!sid) continue;
            const cur = usagePerSub.get(sid) ?? { up: 0, down: 0, total: 0 };
            cur.up += v.up; cur.down += v.down; cur.total += v.total;
            usagePerSub.set(sid, cur);
          }
        } catch (e) {
          panelErrors[p.slug] = e instanceof Error ? e.message : String(e);
        }
      }));

      const rows = Array.from(usagePerSub.entries()).map(([sid, v]) => ({ subscription_id: sid, used_bytes: v.total }));
      if (rows.length) await supabase.from("traffic_snapshots").insert(rows);

      const perSub = (subs ?? []).map((s) => {
        const u = usagePerSub.get(s.id) ?? { up: 0, down: 0, total: 0 };
        return { id: s.id, name: s.name, up: u.up, down: u.down, total: u.total };
      });
      return new Response(JSON.stringify({ perSub, panelErrors }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "create" && req.method === "POST") {
      panelsCache.ts = 0;
      const body = await req.json();
      const name: string = String(body.name ?? "").trim();
      const days: number = Number(body.days ?? 30);
      const totalGB: number = Number(body.totalGB ?? 0);
      const selections: Array<{ panel: PanelKey; inboundId: number }> = body.selections ?? [];

      if (!name) return new Response(JSON.stringify({ error: "name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!selections.length) return new Response(JSON.stringify({ error: "selections required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const validSelections = selections.filter((s) => s?.panel && s.panel !== "null" && s.panel !== "undefined" && Number.isFinite(Number(s.inboundId)));
      if (!validSelections.length) return new Response(JSON.stringify({ error: "Некорректные панели в импорте: panel=null. Обновите патч и импортируйте заново.", selections }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const clientUuid = uuidv4();
      const desiredSlug = String(body.slug ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      let slug = desiredSlug && desiredSlug.length >= 4 ? desiredSlug : randomSlug(12);
      if (desiredSlug) {
        const { data: clash } = await supabase.from("subscriptions").select("id").eq("slug", slug).maybeSingle();
        if (clash) slug = randomSlug(12);
      }
      const subId = randomSlug(16);
      const baseEmail = `${name.replace(/[^a-zA-Z0-9_-]/g, "_")}_${slug.slice(0, 6)}`;
      const expiryMs = days > 0 ? Date.now() + days * 24 * 60 * 60 * 1000 : 0;
      const totalBytes = totalGB > 0 ? Math.floor(totalGB * 1024 * 1024 * 1024) : 0;

      const { data: sub, error: subErr } = await supabase.from("subscriptions").insert({
        slug, name, client_email: baseEmail, client_uuid: clientUuid, expiry_ms: expiryMs, total_bytes: totalBytes,
      }).select().single();
      if (subErr) throw new Error(`db insert sub: ${subErr.message}`);

      const created: any[] = [];
      const errors: any[] = [];
      for (const sel of validSelections) {
        try {
          const cfg = panelCfg(await getPanelBySlug(sel.panel));
          const inbounds = await listInbounds(sel.panel);
          const ib = inbounds.find((x) => x.id === sel.inboundId);
          if (!ib) throw new Error(`inbound ${sel.inboundId} not found on ${sel.panel}`);
          let flow = ""; let stream: any = {};
          try { stream = JSON.parse(ib.streamSettings); } catch { stream = {}; }
          if (ib.protocol === "vless" && stream.security === "reality") flow = "xtls-rprx-vision";

          const email = `${baseEmail}_${sel.panel}${ib.id}`;
          await addClient(sel.panel, sel.inboundId, { id: clientUuid, email, expiryTime: expiryMs, totalGB: totalBytes, subId, flow });

          const { error: ibErr } = await supabase.from("subscription_inbounds").insert({
            subscription_id: sub.id, panel: sel.panel, inbound_id: ib.id,
            remark: ib.remark ?? `${sel.panel}-${ib.id}`, protocol: ib.protocol, port: ib.port,
            host: hostFromUrl(cfg.url), stream_settings: stream, client_email: email,
          });
          if (ibErr) throw new Error(`db insert inbound: ${ibErr.message}`);
          created.push({ panel: sel.panel, inboundId: ib.id, remark: ib.remark });
        } catch (e) {
          errors.push({ panel: sel.panel, inboundId: sel.inboundId, error: e instanceof Error ? e.message : String(e) });
        }
      }

      if (created.length === 0) {
        await supabase.from("subscriptions").delete().eq("id", sub.id);
        return new Response(JSON.stringify({ error: "All inbounds failed", details: errors }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ subscription: sub, created, errors }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "createDetached" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const name: string = String(body.name ?? "").trim();
      const days: number = Number(body.days ?? 30);
      const totalGB: number = Number(body.totalGB ?? 0);
      if (!name) return new Response(JSON.stringify({ error: "name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const desiredSlug = String(body.slug ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      let slug = desiredSlug && desiredSlug.length >= 4 ? desiredSlug : randomSlug(12);
      if (desiredSlug) {
        const { data: clash } = await supabase.from("subscriptions").select("id").eq("slug", slug).maybeSingle();
        if (clash) slug = randomSlug(12);
      }
      const expiryMs = days > 0 ? Date.now() + days * 24 * 60 * 60 * 1000 : 0;
      const totalBytes = totalGB > 0 ? Math.floor(totalGB * 1024 * 1024 * 1024) : 0;
      const baseEmail = `${name.replace(/[^a-zA-Z0-9_-]/g, "_")}_${slug.slice(0, 6)}`;
      const { data: sub, error } = await supabase.from("subscriptions").insert({
        slug, name, client_email: baseEmail, client_uuid: uuidv4(), expiry_ms: expiryMs, total_bytes: totalBytes,
      }).select().single();
      if (error) throw new Error(`db insert detached sub: ${error.message}`);
      return new Response(JSON.stringify({ subscription: sub, created: [], detached: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "importRaw" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const name = String(body.name ?? "").trim();
      const links = Array.isArray(body.links) ? body.links.map((x: unknown) => String(x).trim()).filter(Boolean) : [];
      const domain = String(body.domain ?? "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
      if (!name) return new Response(JSON.stringify({ error: "name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!links.length) return new Response(JSON.stringify({ error: "links required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const swapHost = (l: string) => {
        if (!domain) return l;
        if (/^vmess:\/\//i.test(l)) {
          try {
            const raw = l.slice(l.indexOf("//") + 2).replace(/-/g, "+").replace(/_/g, "/");
            const cfg = JSON.parse(decodeURIComponent(escape(atob(raw + "===".slice((raw.length + 3) % 4)))));
            cfg.add = domain;
            return "vmess://" + btoa(unescape(encodeURIComponent(JSON.stringify(cfg)))).replace(/=+$/, "");
          } catch { return l; }
        }
        return l.replace(/^([a-z0-9+.-]+:\/\/[^@\s]+@)(\[[^\]]+\]|[^:/?#\s]+)(:\d+)?/i, (_m, a, _old, port = "") => `${a}${domain}${port}`);
      };
      const normalized = links.map(swapHost);
      const slug = randomSlug(12);
      const baseEmail = `${name.replace(/[^a-zA-Z0-9_-]/g, "_")}_${slug.slice(0, 6)}`;
      const { data: sub, error } = await supabase.from("subscriptions").insert({
        slug, name, client_email: baseEmail, client_uuid: uuidv4(), raw_links: normalized, expiry_ms: 0, total_bytes: 0,
      }).select().single();
      if (error) throw new Error(`db insert raw sub: ${error.message}`);
      return new Response(JSON.stringify({ subscription: sub }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete" && req.method === "POST") {
      const body = await req.json();
      const subId: string = body.id;
      if (!subId) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: sub } = await supabase.from("subscriptions").select("id, client_uuid").eq("id", subId).maybeSingle();
      if (!sub) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: links } = await supabase.from("subscription_inbounds").select("panel, inbound_id").eq("subscription_id", subId);
      const errors: any[] = [];
      await Promise.all((links ?? []).map(async (l) => {
        try {
          const res = await panelFetch(l.panel as PanelKey, `/panel/api/inbounds/${l.inbound_id}/delClient/${sub.client_uuid}`, { method: "POST" });
          let j: any = {}; try { j = JSON.parse(res.body); } catch {}
          if (!j.success) errors.push({ panel: l.panel, inbound: l.inbound_id, msg: j.msg });
        } catch (e) {
          errors.push({ panel: l.panel, inbound: l.inbound_id, error: e instanceof Error ? e.message : String(e) });
        }
      }));
      await supabase.from("subscriptions").delete().eq("id", subId);
      return new Response(JSON.stringify({ ok: true, errors }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "addInbounds" && req.method === "POST") {
      const body = await req.json();
      const subId: string = body.id;
      const selections: Array<{ panel: PanelKey; inboundId: number }> = body.selections ?? [];
      if (!subId || !selections.length) return new Response(JSON.stringify({ error: "id and selections required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: sub } = await supabase.from("subscriptions").select("id, client_uuid, client_email, expiry_ms, total_bytes, slug").eq("id", subId).maybeSingle();
      if (!sub) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: existingLinks } = await supabase.from("subscription_inbounds").select("panel, inbound_id").eq("subscription_id", subId);
      const existingSet = new Set((existingLinks ?? []).map((l) => `${l.panel}:${l.inbound_id}`));

      const created: any[] = [];
      const errors: any[] = [];
      const subIdShort = sub.slug.slice(0, 16);
      for (const sel of selections) {
        const k = `${sel.panel}:${sel.inboundId}`;
        if (existingSet.has(k)) { errors.push({ panel: sel.panel, inboundId: sel.inboundId, error: "already added" }); continue; }
        try {
          const cfg = panelCfg(await getPanelBySlug(sel.panel));
          const inbounds = await listInbounds(sel.panel);
          const ib = inbounds.find((x) => x.id === sel.inboundId);
          if (!ib) throw new Error(`inbound ${sel.inboundId} not found on ${sel.panel}`);
          let flow = ""; let stream: any = {};
          try { stream = JSON.parse(ib.streamSettings); } catch { stream = {}; }
          if (ib.protocol === "vless" && stream.security === "reality") flow = "xtls-rprx-vision";

          const email = `${sub.client_email}_${sel.panel}${ib.id}`;
          await addClient(sel.panel, sel.inboundId, { id: sub.client_uuid, email, expiryTime: sub.expiry_ms, totalGB: sub.total_bytes, subId: subIdShort, flow });
          const { error: ibErr } = await supabase.from("subscription_inbounds").insert({
            subscription_id: sub.id, panel: sel.panel, inbound_id: ib.id,
            remark: ib.remark ?? `${sel.panel}-${ib.id}`, protocol: ib.protocol, port: ib.port,
            host: hostFromUrl(cfg.url), stream_settings: stream, client_email: email,
          });
          if (ibErr) throw new Error(`db insert inbound: ${ibErr.message}`);
          created.push({ panel: sel.panel, inboundId: ib.id, remark: ib.remark });
        } catch (e) {
          errors.push({ panel: sel.panel, inboundId: sel.inboundId, error: e instanceof Error ? e.message : String(e) });
        }
      }
      return new Response(JSON.stringify({ created, errors }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "removeInbound" && req.method === "POST") {
      const body = await req.json();
      const subId: string = body.id;
      const panel: PanelKey = body.panel;
      const inboundId: number = Number(body.inboundId);
      if (!subId || !panel || !inboundId) return new Response(JSON.stringify({ error: "id, panel, inboundId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: sub } = await supabase.from("subscriptions").select("id, client_uuid").eq("id", subId).maybeSingle();
      if (!sub) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      let panelErr: string | null = null;
      try {
        const res = await panelFetch(panel, `/panel/api/inbounds/${inboundId}/delClient/${sub.client_uuid}`, { method: "POST" });
        let j: any = {}; try { j = JSON.parse(res.body); } catch {}
        if (!j.success) panelErr = j.msg ?? "panel error";
      } catch (e) {
        panelErr = e instanceof Error ? e.message : String(e);
      }
      await supabase.from("subscription_inbounds").delete().eq("subscription_id", subId).eq("panel", panel).eq("inbound_id", inboundId);
      return new Response(JSON.stringify({ ok: true, panelError: panelErr }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update" && req.method === "POST") {
      const body = await req.json();
      const subId: string = body.id;
      if (!subId) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: sub } = await supabase.from("subscriptions").select("id, slug, name, client_uuid, client_email, expiry_ms, total_bytes").eq("id", subId).maybeSingle();
      if (!sub) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const newName: string | undefined = typeof body.name === "string" ? body.name.trim() : undefined;
      const hasDays = body.days !== undefined && body.days !== null && body.days !== "";
      const hasGB = body.totalGB !== undefined && body.totalGB !== null && body.totalGB !== "";
      const days = hasDays ? Number(body.days) : null;
      const totalGB = hasGB ? Number(body.totalGB) : null;
      const newExpiry = hasDays ? (days! > 0 ? Date.now() + days! * 86400000 : 0) : sub.expiry_ms;
      const newTotal = hasGB ? (totalGB! > 0 ? Math.floor(totalGB! * 1024 * 1024 * 1024) : 0) : sub.total_bytes;

      const errors: any[] = [];
      if (hasDays || hasGB) {
        const { data: links } = await supabase.from("subscription_inbounds").select("panel, inbound_id, protocol, stream_settings, client_email").eq("subscription_id", subId);
        const subIdShort = sub.slug.slice(0, 16);
        for (const l of links ?? []) {
          try {
            let flow = ""; const stream: any = l.stream_settings ?? {};
            if (l.protocol === "vless" && stream.security === "reality") flow = "xtls-rprx-vision";
            await updateClient(l.panel as PanelKey, l.inbound_id, { id: sub.client_uuid, email: l.client_email ?? sub.client_email, expiryTime: newExpiry, totalGB: newTotal, subId: subIdShort, flow });
          } catch (e) {
            errors.push({ panel: l.panel, inbound: l.inbound_id, error: e instanceof Error ? e.message : String(e) });
          }
        }
      }

      const upd: any = {};
      if (newName !== undefined && newName.length > 0) upd.name = newName;
      if (hasDays) upd.expiry_ms = newExpiry;
      if (hasGB) upd.total_bytes = newTotal;
      if (Object.keys(upd).length) {
        const { error: uErr } = await supabase.from("subscriptions").update(upd).eq("id", subId);
        if (uErr) throw new Error(`db update: ${uErr.message}`);
      }

      return new Response(JSON.stringify({ ok: true, errors }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
