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
  sniOverride?: string,
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
    const sni = sniOverride || (Array.isArray(r.serverNames) ? r.serverNames[0] : undefined);
    if (sni) params.set("sni", sni);
    if (Array.isArray(r.shortIds) && r.shortIds[0]) params.set("sid", r.shortIds[0]);
    if (settings.publicKey) params.set("pbk", settings.publicKey);
    if (settings.fingerprint) params.set("fp", settings.fingerprint);
    params.set("flow", "xtls-rprx-vision");
  }
  // TLS
  if (security === "tls" && ss.tlsSettings) {
    const t = ss.tlsSettings;
    const sni = sniOverride || t.serverName;
    if (sni) params.set("sni", sni);
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

  const displayRemark = mapRemark(inbound.remark);
  const remark = encodeURIComponent(displayRemark);
  return `vless://${uuid}@${inbound.host}:${inbound.port}?${params.toString()}#${remark}`;
}

// Friendly remark overrides for subscription display
function mapRemark(remark: string): string {
  const map: Record<string, string> = {
    YouTubeRU: "🇷🇺 YouTube без рекламы",
    dpBeget_ru: "🇨🇿 Чехия",
  };
  return map[remark] ?? remark;
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
      .select("id, name, client_email, client_uuid, expiry_ms, total_bytes, hits, sni_whitelist")
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
    const whitelist: string[] = Array.isArray((sub as any).sni_whitelist)
      ? (sub as any).sni_whitelist.filter((s: string) => typeof s === "string" && s.trim().length > 0)
      : [];
    for (const ib of inbounds ?? []) {
      const sniOverride = whitelist.length > 0
        ? whitelist[Math.floor(Math.random() * whitelist.length)]
        : undefined;
      const link = buildVless(sub.client_uuid, sub.client_email, ib as any, sniOverride);
      if (link) lines.push(link);
    }

    const body = btoa(lines.join("\n"));

    // Fire-and-forget hit counter
    supabase
      .from("subscriptions")
      .update({ hits: (sub.hits ?? 0) + 1, last_accessed_at: new Date().toISOString() })
      .eq("id", sub.id)
      .then(() => {});

    // Compute aggregate userinfo (used traffic from latest snapshot)
    let used = 0;
    const { data: lastSnap } = await supabase
      .from("traffic_snapshots")
      .select("used_bytes")
      .eq("subscription_id", sub.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastSnap?.used_bytes != null) used = Number(lastSnap.used_bytes);

    const upload = 0;
    const download = used;
    const total = sub.total_bytes ?? 0; // 0 = unlimited
    const expire = sub.expiry_ms ? Math.floor(sub.expiry_ms / 1000) : 0;

    const profileTitle = "base64:" + btoa(unescape(encodeURIComponent(sub.name)));

    // Announce text under the title (Happ supports Announce header)
    let announceText = "";
    if (!sub.expiry_ms || sub.expiry_ms === 0) {
      announceText = "♾ Без ограничения по времени";
    } else {
      const diff = sub.expiry_ms - Date.now();
      if (diff <= 0) {
        announceText = "⛔ Подписка истекла";
      } else {
        const d = Math.ceil(diff / 86400000);
        const word = (() => {
          const n10 = d % 10, n100 = d % 100;
          if (n10 === 1 && n100 !== 11) return "день";
          if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return "дня";
          return "дней";
        })();
        announceText = `⏳ Осталось ${d} ${word}`;
      }
    }
    const announce = "base64:" + btoa(unescape(encodeURIComponent(announceText)));

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "content-type": "text/plain; charset=utf-8",
        "profile-title": profileTitle,
        "profile-update-interval": "12",
        "subscription-userinfo": `upload=${upload}; download=${download}; total=${total}; expire=${expire}`,
        "announce": announce,
        "content-disposition": `attachment; filename=${encodeURIComponent(sub.name)}`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(`Error: ${msg}`, { status: 500, headers: corsHeaders });
  }
});

// ===== HTML landing page =====
function fmtBytes(b: number): string {
  if (!b) return "∞";
  const u = ["B", "KiB", "MiB", "GiB", "TiB"];
  let i = 0;
  let v = b;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(2)} ${u[i]}`;
}

function daysLeft(ms: number): string {
  if (!ms) return "Бессрочно";
  const diff = ms - Date.now();
  if (diff <= 0) return "Истекла";
  const d = Math.ceil(diff / 86400000);
  return `Истекает через ${d} ${plural(d, ["день", "дня", "дней"])}`;
}

function plural(n: number, forms: [string, string, string]): string {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}

function fmtDate(ms: number): string {
  if (!ms) return "∞";
  return new Date(ms).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
}

function renderPage(opts: {
  name: string;
  expiryMs: number;
  usedBytes: number;
  totalBytes: number;
  subUrl: string;
}): string {
  const { name, expiryMs, usedBytes, totalBytes, subUrl } = opts;
  const happLink = `happ://add/${encodeURIComponent(subUrl)}`;
  const expired = expiryMs > 0 && expiryMs < Date.now();
  const statusLabel = expired ? "Истекла" : "Активна";
  const statusColor = expired ? "#f87171" : "#34d399";

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(name)} — VPN подписка</title>
<style>
:root{
  --bg:#0a0f1a; --bg2:#0d1422; --card:rgba(20,28,46,.7); --border:rgba(56,189,248,.18);
  --text:#e6edf7; --muted:#8a96ad; --accent:#22d3ee; --accent2:#0ea5e9;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,sans-serif;-webkit-font-smoothing:antialiased}
body{
  min-height:100vh;
  background:
    radial-gradient(1200px 600px at 50% -10%, rgba(34,211,238,.10), transparent 60%),
    linear-gradient(180deg,#0a0f1a 0%,#070b13 100%);
  background-attachment:fixed;
}
body::before{
  content:"";position:fixed;inset:0;pointer-events:none;opacity:.18;
  background-image:linear-gradient(rgba(56,189,248,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,.12) 1px,transparent 1px);
  background-size:40px 40px;
  mask-image:radial-gradient(ellipse at center, #000 30%, transparent 75%);
}
.wrap{max-width:460px;margin:0 auto;padding:48px 20px 60px;position:relative;z-index:1;display:flex;flex-direction:column;gap:20px;align-items:stretch}
.card{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:26px;backdrop-filter:blur(12px);text-align:center}
.name{font-size:24px;font-weight:700;margin:0 0 6px}
.sub{color:var(--muted);font-size:14px;margin-bottom:18px}
.status{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:rgba(52,211,153,.12);color:${statusColor};font-weight:600;font-size:13px}
.status .dot{width:8px;height:8px;border-radius:50%;background:${statusColor};box-shadow:0 0 8px ${statusColor}}
.btn{display:flex;align-items:center;justify-content:center;gap:8px;padding:16px 18px;border-radius:14px;border:1px solid var(--border);background:rgba(34,211,238,.10);color:var(--accent);text-decoration:none;font-weight:700;font-size:16px;cursor:pointer;transition:.2s;width:100%}
.btn:hover{background:rgba(34,211,238,.18)}
.btn-primary{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#031018;border-color:transparent;font-size:17px}
.btn-primary:hover{filter:brightness(1.1)}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:#0ea5e9;color:#fff;padding:10px 18px;border-radius:10px;opacity:0;transition:.3s;z-index:50;font-weight:600;font-size:14px}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <h1 class="name">${escapeHtml(name)}</h1>
    <div class="sub">${daysLeft(expiryMs)}</div>
    <div class="status"><span class="dot"></span>${statusLabel}</div>
  </div>

  <a class="btn btn-primary" href="${escapeAttr(happLink)}">⚡ Подключить в Happ</a>
  <button class="btn" onclick="copyLink()">📋 Скопировать ссылку</button>
</div>

<div class="toast" id="toast">Скопировано</div>

<script>
const SUB_URL = ${JSON.stringify(subUrl)};
function copyLink(){
  navigator.clipboard.writeText(SUB_URL).then(()=>{
    const t=document.getElementById('toast');
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'),1600);
  });
}
document.querySelectorAll('.platform').forEach(el=>{
  el.addEventListener('click',()=>{
    document.querySelectorAll('.platform').forEach(x=>x.classList.remove('active'));
    el.classList.add('active');
  });
});
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function escapeAttr(s: string): string { return escapeHtml(s); }