import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import https from "node:https";
import http from "node:http";
import { Buffer } from "node:buffer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type PanelKey = "cz" | "ru";

function getPanelConfig(key: PanelKey) {
  const prefix = key === "cz" ? "PANEL_CZ" : "PANEL_RU";
  const url = Deno.env.get(`${prefix}_URL`);
  const username = Deno.env.get(`${prefix}_USERNAME`);
  const password = Deno.env.get(`${prefix}_PASSWORD`);
  if (!url || !username || !password) {
    throw new Error(`Panel ${key} is not configured`);
  }
  return { url: url.replace(/\/+$/, ""), username, password };
}

// Cache cookies in-memory per cold-start
const cookieCache = new Map<PanelKey, { cookie: string; ts: number }>();
const COOKIE_TTL_MS = 30 * 60 * 1000;

// Use node:https to allow skipping TLS verification on panels with expired certs
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

async function loginPanel(key: PanelKey): Promise<string> {
  const cached = cookieCache.get(key);
  if (cached && Date.now() - cached.ts < COOKIE_TTL_MS) return cached.cookie;

  const cfg = getPanelConfig(key);
  const res = await nodeRequest(`${cfg.url}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: cfg.username, password: cfg.password }).toString(),
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Login failed [${key}] ${res.status}: ${res.body}`);
  }
  const sc = res.headers["set-cookie"];
  const setCookies: string[] = Array.isArray(sc) ? sc : sc ? [sc as string] : [];
  const cookie = setCookies
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
  if (!cookie) throw new Error(`No cookie from panel ${key}`);

  cookieCache.set(key, { cookie, ts: Date.now() });
  return cookie;
}

async function panelFetch(
  key: PanelKey,
  path: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) {
  const cfg = getPanelConfig(key);
  let cookie = await loginPanel(key);
  const doReq = (ck: string) =>
    nodeRequest(`${cfg.url}${path}`, {
      method: init?.method ?? "GET",
      headers: { ...(init?.headers ?? {}), Cookie: ck, Accept: "application/json" },
      body: init?.body,
    });
  let res = await doReq(cookie);
  if (res.status === 401 || res.status === 403) {
    cookieCache.delete(key);
    cookie = await loginPanel(key);
    res = await doReq(cookie);
  }
  return res;
}

async function listInbounds(key: PanelKey) {
  const res = await panelFetch(key, "/panel/api/inbounds/list", { method: "GET" });
  const json = JSON.parse(res.body);
  if (!json.success) throw new Error(`list inbounds [${key}]: ${json.msg}`);
  return json.obj as any[];
}

async function addClient(
  key: PanelKey,
  inboundId: number,
  client: {
    id: string;
    email: string;
    expiryTime: number;
    totalGB: number;
    subId: string;
    flow?: string;
  },
) {
  const settings = JSON.stringify({
    clients: [
      {
        id: client.id,
        flow: client.flow ?? "",
        email: client.email,
        limitIp: 0,
        totalGB: client.totalGB,
        expiryTime: client.expiryTime,
        enable: true,
        tgId: "",
        subId: client.subId,
        reset: 0,
      },
    ],
  });

  const res = await panelFetch(key, "/panel/api/inbounds/addClient", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: inboundId, settings }),
  });
  const json = JSON.parse(res.body);
  if (!json.success) throw new Error(`addClient [${key}/${inboundId}]: ${json.msg}`);
  return json;
}

async function updateClient(
  key: PanelKey,
  inboundId: number,
  client: {
    id: string;
    email: string;
    expiryTime: number;
    totalGB: number;
    subId: string;
    flow?: string;
  },
) {
  const settings = JSON.stringify({
    clients: [
      {
        id: client.id,
        flow: client.flow ?? "",
        email: client.email,
        limitIp: 0,
        totalGB: client.totalGB,
        expiryTime: client.expiryTime,
        enable: true,
        tgId: "",
        subId: client.subId,
        reset: 0,
      },
    ],
  });
  const res = await panelFetch(key, `/panel/api/inbounds/updateClient/${client.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: inboundId, settings }),
  });
  const json = JSON.parse(res.body);
  if (!json.success) throw new Error(`updateClient [${key}/${inboundId}]: ${json.msg}`);
  return json;
}

function uuidv4() {
  return crypto.randomUUID();
}
function randomSlug(len = 12) {
  const a = "abcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => a[n % a.length]).join("");
}

function hostFromUrl(u: string) {
  try {
    return new URL(u).hostname;
  } catch {
    return u;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "";

    if (action === "inbounds") {
      // List inbounds from both panels
      const result: Record<string, any> = {};
      for (const key of ["cz", "ru"] as PanelKey[]) {
        try {
          const inbounds = await listInbounds(key);
          result[key] = inbounds.map((ib) => ({
            id: ib.id,
            remark: ib.remark,
            protocol: ib.protocol,
            port: ib.port,
            enable: ib.enable,
          }));
        } catch (e) {
          result[key] = { error: e instanceof Error ? e.message : String(e) };
        }
      }
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create" && req.method === "POST") {
      const body = await req.json();
      const name: string = String(body.name ?? "").trim();
      const days: number = Number(body.days ?? 30);
      const totalGB: number = Number(body.totalGB ?? 0); // 0 = unlimited
      const selections: Array<{ panel: PanelKey; inboundId: number }> = body.selections ?? [];

      if (!name) return new Response(JSON.stringify({ error: "name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!selections.length) return new Response(JSON.stringify({ error: "selections required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const clientUuid = uuidv4();
      const slug = randomSlug(12);
      const subId = randomSlug(16);
      const email = `${name.replace(/[^a-zA-Z0-9_-]/g, "_")}_${slug.slice(0, 6)}`;
      const expiryMs = days > 0 ? Date.now() + days * 24 * 60 * 60 * 1000 : 0;
      const totalBytes = totalGB > 0 ? Math.floor(totalGB * 1024 * 1024 * 1024) : 0;

      // Insert subscription record first
      const { data: sub, error: subErr } = await supabase
        .from("subscriptions")
        .insert({
          slug,
          name,
          client_email: email,
          client_uuid: clientUuid,
          expiry_ms: expiryMs,
          total_bytes: totalBytes,
        })
        .select()
        .single();
      if (subErr) throw new Error(`db insert sub: ${subErr.message}`);

      // For each selected inbound: add client on panel + snapshot inbound info
      const created: any[] = [];
      const errors: any[] = [];
      for (const sel of selections) {
        try {
          const cfg = getPanelConfig(sel.panel);
          const inbounds = await listInbounds(sel.panel);
          const ib = inbounds.find((x) => x.id === sel.inboundId);
          if (!ib) throw new Error(`inbound ${sel.inboundId} not found on ${sel.panel}`);

          // Reality vless requires xtls-rprx-vision flow
          let flow = "";
          let stream: any = {};
          try { stream = JSON.parse(ib.streamSettings); } catch { stream = {}; }
          if (ib.protocol === "vless" && stream.security === "reality") {
            flow = "xtls-rprx-vision";
          }

          await addClient(sel.panel, sel.inboundId, {
            id: clientUuid,
            email,
            expiryTime: expiryMs,
            totalGB: totalBytes,
            subId,
            flow,
          });

          const { error: ibErr } = await supabase.from("subscription_inbounds").insert({
            subscription_id: sub.id,
            panel: sel.panel,
            inbound_id: ib.id,
            remark: ib.remark ?? `${sel.panel}-${ib.id}`,
            protocol: ib.protocol,
            port: ib.port,
            host: hostFromUrl(cfg.url),
            stream_settings: stream,
          });
          if (ibErr) throw new Error(`db insert inbound: ${ibErr.message}`);

          created.push({ panel: sel.panel, inboundId: ib.id, remark: ib.remark });
        } catch (e) {
          errors.push({ panel: sel.panel, inboundId: sel.inboundId, error: e instanceof Error ? e.message : String(e) });
        }
      }

      if (created.length === 0) {
        // rollback subscription
        await supabase.from("subscriptions").delete().eq("id", sub.id);
        return new Response(JSON.stringify({ error: "All inbounds failed", details: errors }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ subscription: sub, created, errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete" && req.method === "POST") {
      const body = await req.json();
      const subId: string = body.id;
      if (!subId) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id, client_uuid")
        .eq("id", subId)
        .maybeSingle();
      if (!sub) {
        return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: links } = await supabase
        .from("subscription_inbounds")
        .select("panel, inbound_id")
        .eq("subscription_id", subId);

      const errors: any[] = [];
      for (const l of links ?? []) {
        try {
          const res = await panelFetch(l.panel as PanelKey, `/panel/api/inbounds/${l.inbound_id}/delClient/${sub.client_uuid}`, { method: "POST" });
          let j: any = {};
          try { j = JSON.parse(res.body); } catch {}
          if (!j.success) errors.push({ panel: l.panel, inbound: l.inbound_id, msg: j.msg });
        } catch (e) {
          errors.push({ panel: l.panel, inbound: l.inbound_id, error: e instanceof Error ? e.message : String(e) });
        }
      }

      await supabase.from("subscriptions").delete().eq("id", subId);
      return new Response(JSON.stringify({ ok: true, errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "addInbounds" && req.method === "POST") {
      const body = await req.json();
      const subId: string = body.id;
      const selections: Array<{ panel: PanelKey; inboundId: number }> = body.selections ?? [];
      if (!subId || !selections.length) {
        return new Response(JSON.stringify({ error: "id and selections required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id, client_uuid, client_email, expiry_ms, total_bytes, slug")
        .eq("id", subId)
        .maybeSingle();
      if (!sub) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: existingLinks } = await supabase
        .from("subscription_inbounds")
        .select("panel, inbound_id")
        .eq("subscription_id", subId);
      const existingSet = new Set((existingLinks ?? []).map((l) => `${l.panel}:${l.inbound_id}`));

      const created: any[] = [];
      const errors: any[] = [];
      const subIdShort = sub.slug.slice(0, 16);
      for (const sel of selections) {
        const k = `${sel.panel}:${sel.inboundId}`;
        if (existingSet.has(k)) {
          errors.push({ panel: sel.panel, inboundId: sel.inboundId, error: "already added" });
          continue;
        }
        try {
          const cfg = getPanelConfig(sel.panel);
          const inbounds = await listInbounds(sel.panel);
          const ib = inbounds.find((x) => x.id === sel.inboundId);
          if (!ib) throw new Error(`inbound ${sel.inboundId} not found on ${sel.panel}`);
          let flow = "";
          let stream: any = {};
          try { stream = JSON.parse(ib.streamSettings); } catch { stream = {}; }
          if (ib.protocol === "vless" && stream.security === "reality") flow = "xtls-rprx-vision";

          await addClient(sel.panel, sel.inboundId, {
            id: sub.client_uuid,
            email: sub.client_email,
            expiryTime: sub.expiry_ms,
            totalGB: sub.total_bytes,
            subId: subIdShort,
            flow,
          });
          const { error: ibErr } = await supabase.from("subscription_inbounds").insert({
            subscription_id: sub.id,
            panel: sel.panel,
            inbound_id: ib.id,
            remark: ib.remark ?? `${sel.panel}-${ib.id}`,
            protocol: ib.protocol,
            port: ib.port,
            host: hostFromUrl(cfg.url),
            stream_settings: stream,
          });
          if (ibErr) throw new Error(`db insert inbound: ${ibErr.message}`);
          created.push({ panel: sel.panel, inboundId: ib.id, remark: ib.remark });
        } catch (e) {
          errors.push({ panel: sel.panel, inboundId: sel.inboundId, error: e instanceof Error ? e.message : String(e) });
        }
      }
      return new Response(JSON.stringify({ created, errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "removeInbound" && req.method === "POST") {
      const body = await req.json();
      const subId: string = body.id;
      const panel: PanelKey = body.panel;
      const inboundId: number = Number(body.inboundId);
      if (!subId || !panel || !inboundId) {
        return new Response(JSON.stringify({ error: "id, panel, inboundId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id, client_uuid")
        .eq("id", subId)
        .maybeSingle();
      if (!sub) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      let panelErr: string | null = null;
      try {
        const res = await panelFetch(panel, `/panel/api/inbounds/${inboundId}/delClient/${sub.client_uuid}`, { method: "POST" });
        let j: any = {};
        try { j = JSON.parse(res.body); } catch {}
        if (!j.success) panelErr = j.msg ?? "panel error";
      } catch (e) {
        panelErr = e instanceof Error ? e.message : String(e);
      }
      await supabase
        .from("subscription_inbounds")
        .delete()
        .eq("subscription_id", subId)
        .eq("panel", panel)
        .eq("inbound_id", inboundId);
      return new Response(JSON.stringify({ ok: true, panelError: panelErr }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update" && req.method === "POST") {
      const body = await req.json();
      const subId: string = body.id;
      if (!subId) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id, slug, name, client_uuid, client_email, expiry_ms, total_bytes")
        .eq("id", subId)
        .maybeSingle();
      if (!sub) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const newName: string | undefined = typeof body.name === "string" ? body.name.trim() : undefined;
      const hasDays = body.days !== undefined && body.days !== null && body.days !== "";
      const hasGB = body.totalGB !== undefined && body.totalGB !== null && body.totalGB !== "";
      const days = hasDays ? Number(body.days) : null;
      const totalGB = hasGB ? Number(body.totalGB) : null;
      const newExpiry = hasDays ? (days! > 0 ? Date.now() + days! * 86400000 : 0) : sub.expiry_ms;
      const newTotal = hasGB ? (totalGB! > 0 ? Math.floor(totalGB! * 1024 * 1024 * 1024) : 0) : sub.total_bytes;

      const errors: any[] = [];
      // Push expiry/totalBytes changes to panels
      if (hasDays || hasGB) {
        const { data: links } = await supabase
          .from("subscription_inbounds")
          .select("panel, inbound_id, protocol, stream_settings")
          .eq("subscription_id", subId);
        const subIdShort = sub.slug.slice(0, 16);
        for (const l of links ?? []) {
          try {
            let flow = "";
            const stream: any = l.stream_settings ?? {};
            if (l.protocol === "vless" && stream.security === "reality") flow = "xtls-rprx-vision";
            await updateClient(l.panel as PanelKey, l.inbound_id, {
              id: sub.client_uuid,
              email: sub.client_email,
              expiryTime: newExpiry,
              totalGB: newTotal,
              subId: subIdShort,
              flow,
            });
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

      return new Response(JSON.stringify({ ok: true, errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});