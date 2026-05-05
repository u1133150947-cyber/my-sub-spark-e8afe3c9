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

    // Browser request → render HTML landing page
    const accept = req.headers.get("accept") ?? "";
    const ua = req.headers.get("user-agent") ?? "";
    const wantsHtml =
      accept.includes("text/html") &&
      !/clash|sing-box|v2ray|happ|throne|koala|flclash|prizrak|stash|shadowrocket/i.test(ua);

    if (wantsHtml) {
      const html = renderPage({
        name: sub.name,
        expiryMs: sub.expiry_ms ?? 0,
        usedBytes: 0,
        totalBytes: total,
        subUrl: req.url,
      });
      return new Response(html, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

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
.wrap{max-width:760px;margin:0 auto;padding:32px 20px 80px;position:relative;z-index:1}
header{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px}
.logo{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.18em;color:var(--accent);font-size:22px}
.logo svg{width:28px;height:28px}
.icon-btn{width:42px;height:42px;border-radius:12px;background:var(--card);border:1px solid var(--border);display:inline-flex;align-items:center;justify-content:center;color:var(--accent);cursor:pointer;transition:.2s}
.icon-btn:hover{background:rgba(34,211,238,.1)}
.icon-btn svg{width:18px;height:18px}
.card{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:22px;margin-bottom:18px;backdrop-filter:blur(12px)}
.user-head{display:flex;align-items:center;gap:14px;margin-bottom:18px}
.user-avatar{width:46px;height:46px;border-radius:50%;background:rgba(52,211,153,.15);display:flex;align-items:center;justify-content:center;color:#34d399}
.user-avatar svg{width:24px;height:24px}
.user-name{font-size:22px;font-weight:700}
.user-sub{color:var(--muted);font-size:14px;margin-top:2px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:520px){.grid{grid-template-columns:1fr}}
.stat{border:1px solid var(--border);border-radius:14px;padding:14px;background:rgba(8,14,26,.4)}
.stat .lbl{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;margin-bottom:6px}
.stat .val{font-weight:600;font-size:15px}
.stat.status{background:rgba(52,211,153,.06);border-color:rgba(52,211,153,.25)}
.stat.expire{background:rgba(248,113,113,.05);border-color:rgba(248,113,113,.22)}
.stat.expire .lbl{color:#fca5a5}
.stat.traffic{background:rgba(245,158,11,.05);border-color:rgba(245,158,11,.22)}
.stat.traffic .lbl{color:#fcd34d}
.section-title{font-size:20px;font-weight:700;margin:0 0 16px;display:flex;align-items:center;justify-content:space-between}
.platforms{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px}
.platform{display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(8,14,26,.5);border:1px solid var(--border);border-radius:12px;cursor:pointer;font-weight:600;color:var(--text);transition:.2s}
.platform:hover{background:rgba(34,211,238,.08)}
.platform.active{background:rgba(34,211,238,.15);border-color:var(--accent);color:var(--accent)}
.platform .dot{width:6px;height:6px;border-radius:50%;background:#fbbf24}
.step{display:flex;gap:14px;align-items:flex-start;padding:16px;background:rgba(8,14,26,.4);border:1px solid var(--border);border-radius:14px;margin-bottom:12px}
.step-icon{width:40px;height:40px;border-radius:50%;background:rgba(34,211,238,.12);color:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.step-icon svg{width:20px;height:20px}
.step-icon.green{background:rgba(52,211,153,.12);color:#34d399}
.step-icon.red{background:rgba(248,113,113,.12);color:#f87171}
.step-body{flex:1;min-width:0}
.step-title{font-weight:700;margin-bottom:6px}
.step-desc{color:var(--muted);font-size:14px;line-height:1.5}
.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:10px;border:1px solid var(--border);background:rgba(34,211,238,.10);color:var(--accent);text-decoration:none;font-weight:600;font-size:14px;cursor:pointer;transition:.2s;margin-top:10px;margin-right:8px}
.btn:hover{background:rgba(34,211,238,.18)}
.btn svg{width:14px;height:14px}
.btn-primary{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#031018;border-color:transparent}
.btn-primary:hover{filter:brightness(1.1)}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:#0ea5e9;color:#fff;padding:10px 18px;border-radius:10px;opacity:0;transition:.3s;z-index:50;font-weight:600;font-size:14px}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="logo">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12h3l3-9 6 18 3-9h3"/></svg>
      VPN
    </div>
    <button class="icon-btn" onclick="copyLink()" title="Скопировать ссылку">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
    </button>
  </header>

  <div class="card">
    <div class="user-head">
      <div class="user-avatar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>
      </div>
      <div>
        <div class="user-name">${escapeHtml(name)}</div>
        <div class="user-sub">${daysLeft(expiryMs)}</div>
      </div>
    </div>
    <div class="grid">
      <div class="stat"><div class="lbl">👤 Имя пользователя</div><div class="val">${escapeHtml(name)}</div></div>
      <div class="stat status"><div class="lbl" style="color:#86efac">✓ Статус</div><div class="val" style="color:${statusColor}">${statusLabel}</div></div>
      <div class="stat expire"><div class="lbl">📅 Истекает</div><div class="val">${fmtDate(expiryMs)}</div></div>
      <div class="stat traffic"><div class="lbl">↕ Трафик</div><div class="val">${fmtBytes(usedBytes)} / ${totalBytes ? fmtBytes(totalBytes) : "∞"}</div></div>
    </div>
  </div>

  <div class="card">
    <h2 class="section-title">Установка</h2>
    <div class="platforms" id="platforms">
      <div class="platform active" data-app="happ"><span class="dot"></span>Happ</div>
      <div class="platform" data-app="v2box"><span class="dot"></span>V2Box</div>
      <div class="platform" data-app="streisand"><span class="dot"></span>Streisand</div>
      <div class="platform" data-app="hiddify"><span class="dot"></span>Hiddify</div>
    </div>

    <div class="step">
      <div class="step-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg></div>
      <div class="step-body">
        <div class="step-title">Установка приложения</div>
        <div class="step-desc">Скачайте и установите приложение для вашей платформы.</div>
        <a class="btn" href="https://apps.apple.com/app/happ-proxy-utility/id6504287215" target="_blank">📱 App Store</a>
        <a class="btn" href="https://play.google.com/store/apps/details?id=com.happproxy" target="_blank">🤖 Google Play</a>
      </div>
    </div>

    <div class="step">
      <div class="step-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
      <div class="step-body">
        <div class="step-title">Добавление подписки</div>
        <div class="step-desc">Нажмите кнопку ниже — подписка автоматически откроется в приложении. Или скопируйте ссылку и добавьте вручную.</div>
        <a class="btn btn-primary" href="${escapeAttr(happLink)}">⚡ Добавить в Happ</a>
        <button class="btn" onclick="copyLink()">📋 Скопировать ссылку</button>
      </div>
    </div>

    <div class="step">
      <div class="step-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></div>
      <div class="step-body">
        <div class="step-title">Подключение</div>
        <div class="step-desc">Откройте приложение, выберите нужный сервер из списка и нажмите кнопку подключения. Готово — ваш трафик защищён.</div>
      </div>
    </div>
  </div>
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