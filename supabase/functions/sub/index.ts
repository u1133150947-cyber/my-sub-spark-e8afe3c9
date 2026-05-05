import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Build a vless:// URL from inbound snapshot + client uuid
function buildVless(
  uuid: string,
  email: string,
  inbound: {
    protocol: string;
    port: number;
    host: string;
    remark: string;
    stream_settings: any;
  },
) {
  if (inbound.protocol !== "vless") {
    // Only vless supported for now
    return null;
  }
  const ss = inbound.stream_settings ?? {};
  const network: string = ss.network ?? "tcp";
  const security: string = ss.security ?? "none";

  const params = new URLSearchParams();
  params.set("type", network);
  params.set("security", security);
  params.set("encryption", "none");

  // Reality
  if (security === "reality" && ss.realitySettings) {
    const r = ss.realitySettings;
    const settings = r.settings ?? {};
    if (Array.isArray(r.serverNames) && r.serverNames[0]) params.set("sni", r.serverNames[0]);
    if (Array.isArray(r.shortIds) && r.shortIds[0]) params.set("sid", r.shortIds[0]);
    if (settings.publicKey) params.set("pbk", settings.publicKey);
    if (settings.fingerprint) params.set("fp", settings.fingerprint);
    params.set("flow", "xtls-rprx-vision");
  }
  // TLS
  if (security === "tls" && ss.tlsSettings) {
    const t = ss.tlsSettings;
    if (t.serverName) params.set("sni", t.serverName);
    if (Array.isArray(t.alpn)) params.set("alpn", t.alpn.join(","));
    const fp = t.settings?.fingerprint;
    if (fp) params.set("fp", fp);
  }
  // Network specific
  if (network === "ws" && ss.wsSettings) {
    if (ss.wsSettings.path) params.set("path", ss.wsSettings.path);
    const host = ss.wsSettings.headers?.Host;
    if (host) params.set("host", host);
  }
  if (network === "grpc" && ss.grpcSettings?.serviceName) {
    params.set("serviceName", ss.grpcSettings.serviceName);
  }
  if (network === "tcp" && ss.tcpSettings?.header?.type) {
    params.set("headerType", ss.tcpSettings.header.type);
    const httpHost = ss.tcpSettings.header?.request?.headers?.Host?.[0];
    if (httpHost) params.set("host", httpHost);
    const httpPath = ss.tcpSettings.header?.request?.path?.[0];
    if (httpPath) params.set("path", httpPath);
  }

  const remark = encodeURIComponent(`${inbound.remark} - ${email}`);
  return `vless://${uuid}@${inbound.host}:${inbound.port}?${params.toString()}#${remark}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const slug = parts[parts.length - 1];

    if (!slug || slug === "sub") {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("id, name, client_email, client_uuid, expiry_ms, total_bytes, hits")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !sub) {
      return new Response("Subscription not found", { status: 404, headers: corsHeaders });
    }

    const { data: inbounds } = await supabase
      .from("subscription_inbounds")
      .select("panel, inbound_id, remark, protocol, port, host, stream_settings")
      .eq("subscription_id", sub.id);

    const lines: string[] = [];
    for (const ib of inbounds ?? []) {
      const link = buildVless(sub.client_uuid, sub.client_email, ib as any);
      if (link) lines.push(link);
    }

    const body = btoa(lines.join("\n"));

    // Fire-and-forget hit counter
    supabase
      .from("subscriptions")
      .update({ hits: (sub.hits ?? 0) + 1, last_accessed_at: new Date().toISOString() })
      .eq("id", sub.id)
      .then(() => {});

    // Compute aggregate userinfo
    const upload = 0;
    const download = 0;
    const total = sub.total_bytes ?? 0;
    const expire = sub.expiry_ms ? Math.floor(sub.expiry_ms / 1000) : 0;

    const profileTitle = "base64:" + btoa(unescape(encodeURIComponent(sub.name)));

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "content-type": "text/plain; charset=utf-8",
        "profile-title": profileTitle,
        "profile-update-interval": "12",
        "subscription-userinfo": `upload=${upload}; download=${download}; total=${total}; expire=${expire}`,
        "content-disposition": `attachment; filename=${encodeURIComponent(sub.name)}`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(`Error: ${msg}`, { status: 500, headers: corsHeaders });
  }
});