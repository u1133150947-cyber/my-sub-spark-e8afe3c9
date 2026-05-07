// Test-only: fetch a remote subscription URL (xray JSON or base64 lines),
// parse outbounds and return a normalized list. Server-side to bypass CORS.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ParsedOutbound = {
  remark: string;
  protocol: string;
  host: string;
  port: number;
  uuid?: string;
  stream_settings: Record<string, unknown>;
  raw_link?: string;
};

function parseFromXrayJson(arr: any[]): ParsedOutbound[] {
  const out: ParsedOutbound[] = [];
  for (const cfg of arr) {
    const remark = String(cfg.remarks ?? cfg.remark ?? "").trim() || "config";
    const outs = Array.isArray(cfg.outbounds) ? cfg.outbounds : [];
    // Prefer the "proxy" outbound, else first non-direct/blackhole
    const proxies = outs.filter((o: any) =>
      o && typeof o === "object" &&
      !["freedom", "blackhole", "dns"].includes(o.protocol)
    );
    const candidates = proxies.length === 1 ? proxies : proxies.filter((o: any) => o.tag === "proxy");
    const list = candidates.length ? candidates : proxies.slice(0, 1);
    for (const o of list) {
      const proto = String(o.protocol ?? "");
      let host = "", port = 0, uuid: string | undefined;
      if (proto === "vless" || proto === "vmess" || proto === "trojan") {
        const v = o.settings?.vnext?.[0] ?? o.settings?.servers?.[0];
        host = String(v?.address ?? "");
        port = Number(v?.port ?? 0);
        uuid = v?.users?.[0]?.id ?? v?.password;
      } else if (proto === "hysteria" || proto === "hysteria2") {
        host = String(o.settings?.address ?? "");
        port = Number(o.settings?.port ?? 0);
      }
      if (!host) continue;
      out.push({
        remark: list.length > 1 ? `${remark} · ${o.tag ?? ""}`.trim() : remark,
        protocol: proto,
        host,
        port,
        uuid,
        stream_settings: o.streamSettings ?? {},
      });
    }
  }
  return out;
}

function parseFromVlessLines(text: string): ParsedOutbound[] {
  const out: ParsedOutbound[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith("vless://")) continue;
    try {
      const u = new URL(line);
      const uuid = decodeURIComponent(u.username);
      const host = u.hostname;
      const port = Number(u.port || 443);
      const remark = decodeURIComponent(u.hash.replace(/^#/, "")) || `${host}:${port}`;
      const params = Object.fromEntries(u.searchParams.entries());
      const ss: any = { network: params.type ?? "tcp", security: params.security ?? "none" };
      if (ss.security === "reality") {
        ss.realitySettings = {
          serverNames: params.sni ? [params.sni] : [],
          shortIds: params.sid ? [params.sid] : [],
          settings: { publicKey: params.pbk ?? "", fingerprint: params.fp ?? "chrome" },
        };
      } else if (ss.security === "tls") {
        ss.tlsSettings = { serverName: params.sni ?? "", alpn: params.alpn?.split(",") ?? [] };
      }
      out.push({ remark, protocol: "vless", host, port, uuid, stream_settings: ss, raw_link: line });
    } catch { /* skip */ }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url required" }), { status: 400, headers: { ...cors, "content-type": "application/json" } });
    }
    const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 SubManager/1.0" } });
    if (!r.ok) {
      return new Response(JSON.stringify({ error: `upstream ${r.status}` }), { status: 502, headers: { ...cors, "content-type": "application/json" } });
    }
    const headers: Record<string, string> = {};
    r.headers.forEach((v, k) => { headers[k] = v; });
    const text = await r.text();
    let parsed: ParsedOutbound[] = [];
    let kind = "";
    const trimmed = text.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const j = JSON.parse(trimmed);
        parsed = parseFromXrayJson(Array.isArray(j) ? j : [j]);
        kind = "xray-json";
      } catch { /* not json */ }
    }
    if (!parsed.length) {
      // try base64
      let plain = text;
      try { plain = atob(text.replace(/\s+/g, "")); } catch { /* not base64 */ }
      parsed = parseFromVlessLines(plain);
      kind = "vless-lines";
    }
    return new Response(JSON.stringify({ kind, count: parsed.length, items: parsed, headers }), {
      headers: { ...cors, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...cors, "content-type": "application/json" },
    });
  }
});