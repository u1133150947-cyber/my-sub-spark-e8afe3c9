import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

async function loginPanel(key: PanelKey): Promise<string> {
  const cached = cookieCache.get(key);
  if (cached && Date.now() - cached.ts < COOKIE_TTL_MS) return cached.cookie;

  const cfg = getPanelConfig(key);
  const res = await fetch(`${cfg.url}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: cfg.username, password: cfg.password }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Login failed [${key}] ${res.status}: ${text}`);

  // Collect Set-Cookie (Deno fetch may merge into one)
  const setCookies: string[] = [];
  const headersAny = res.headers as any;
  if (typeof headersAny.getSetCookie === "function") {
    setCookies.push(...headersAny.getSetCookie());
  } else {
    const sc = res.headers.get("set-cookie");
    if (sc) setCookies.push(sc);
  }
  const cookie = setCookies
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
  if (!cookie) throw new Error(`No cookie from panel ${key}`);

  cookieCache.set(key, { cookie, ts: Date.now() });
  return cookie;
}

async function panelFetch(key: PanelKey, path: string, init?: RequestInit) {
  const cfg = getPanelConfig(key);
  let cookie = await loginPanel(key);
  let res = await fetch(`${cfg.url}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), Cookie: cookie, Accept: "application/json" },
  });
  if (res.status === 401 || res.status === 403) {
    cookieCache.delete(key);
    cookie = await loginPanel(key);
    res = await fetch(`${cfg.url}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), Cookie: cookie, Accept: "application/json" },
    });
  }
  return res;
}

async function listInbounds(key: PanelKey) {
  const res = await panelFetch(key, "/panel/api/inbounds/list", { method: "GET" });
  const json = await res.json();
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
  const json = await res.json();
  if (!json.success) throw new Error(`addClient [${key}/${inboundId}]: ${json.msg}`);
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
          const j = await res.json().catch(() => ({}));
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