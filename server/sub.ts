// Port of supabase/functions/sub/index.ts to local SQLite.
import { db, decodeRow } from "./db.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const COUNTRY_INFO: Record<string, { flag: string; name: string }> = {
  RU: { flag: "🇷🇺", name: "Россия" }, CZ: { flag: "🇨🇿", name: "Чехия" },
  DE: { flag: "🇩🇪", name: "Германия" }, NL: { flag: "🇳🇱", name: "Нидерланды" },
  FR: { flag: "🇫🇷", name: "Франция" }, GB: { flag: "🇬🇧", name: "Великобритания" },
  UK: { flag: "🇬🇧", name: "Великобритания" }, US: { flag: "🇺🇸", name: "США" },
  CA: { flag: "🇨🇦", name: "Канада" }, JP: { flag: "🇯🇵", name: "Япония" },
  SG: { flag: "🇸🇬", name: "Сингапур" }, TR: { flag: "🇹🇷", name: "Турция" },
  UA: { flag: "🇺🇦", name: "Украина" }, PL: { flag: "🇵🇱", name: "Польша" },
  FI: { flag: "🇫🇮", name: "Финляндия" }, SE: { flag: "🇸🇪", name: "Швеция" },
  NO: { flag: "🇳🇴", name: "Норвегия" }, ES: { flag: "🇪🇸", name: "Испания" },
  IT: { flag: "🇮🇹", name: "Италия" }, CH: { flag: "🇨🇭", name: "Швейцария" },
  AT: { flag: "🇦🇹", name: "Австрия" }, KZ: { flag: "🇰🇿", name: "Казахстан" },
  CN: { flag: "🇨🇳", name: "Китай" }, HK: { flag: "🇭🇰", name: "Гонконг" },
  IN: { flag: "🇮🇳", name: "Индия" }, BR: { flag: "🇧🇷", name: "Бразилия" },
  AE: { flag: "🇦🇪", name: "ОАЭ" }, LV: { flag: "🇱🇻", name: "Латвия" },
  LT: { flag: "🇱🇹", name: "Литва" }, EE: { flag: "🇪🇪", name: "Эстония" },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanUuid(...values: unknown[]): string {
  for (const value of values) {
    const candidate = String(value ?? "").trim();
    if (UUID_RE.test(candidate)) return candidate;
  }
  return "";
}

function buildVless(uuid: string, email: string, ib: any, sniOverride?: string, overrides?: Map<string, string>) {
  if (ib.protocol !== "vless") return null;
  const ss = ib.stream_settings ?? {};
  const effectiveUuid = cleanUuid(ss._clientUuid, ss.clientUuid, ss.uuid, ss.id, uuid);
  if (!effectiveUuid) return null;
  const network = ss.network ?? "tcp", security = ss.security ?? "none";
  const params = new URLSearchParams();
  params.set("type", network); params.set("security", security); params.set("encryption", "none");
  if (security === "reality" && ss.realitySettings) {
    const r = ss.realitySettings, settings = r.settings ?? {};
    const sni = sniOverride || (Array.isArray(r.serverNames) ? r.serverNames[0] : undefined) || r.serverName;
    if (sni) params.set("sni", sni);
    const sid = (Array.isArray(r.shortIds) && r.shortIds[0]) || r.shortId;
    if (sid) params.set("sid", sid);
    const publicKey = settings.publicKey || r.publicKey;
    if (publicKey) params.set("pbk", publicKey);
    const fingerprint = settings.fingerprint || r.fingerprint;
    if (fingerprint) params.set("fp", fingerprint);
    params.set("flow", "xtls-rprx-vision");
  }
  if (security === "tls" && ss.tlsSettings) {
    const t = ss.tlsSettings;
    const sni = sniOverride || t.serverName;
    if (sni) params.set("sni", sni);
    if (Array.isArray(t.alpn)) params.set("alpn", t.alpn.join(","));
    if (t.settings?.fingerprint) params.set("fp", t.settings.fingerprint);
  }
  if (network === "ws" && ss.wsSettings) {
    if (ss.wsSettings.path) params.set("path", ss.wsSettings.path);
    if (ss.wsSettings.headers?.Host) params.set("host", ss.wsSettings.headers.Host);
  }
  if (network === "grpc" && ss.grpcSettings?.serviceName) params.set("serviceName", ss.grpcSettings.serviceName);
  if ((network === "xhttp" || network === "splithttp") && ss.xhttpSettings) {
    if (ss.xhttpSettings.path) params.set("path", ss.xhttpSettings.path);
    if (ss.xhttpSettings.mode) params.set("mode", ss.xhttpSettings.mode);
    const host = ss.xhttpSettings.headers?.Host;
    if (host) params.set("host", Array.isArray(host) ? host[0] : host);
  }
  if (network === "tcp" && ss.tcpSettings?.header?.type) {
    params.set("headerType", ss.tcpSettings.header.type);
    const httpHost = ss.tcpSettings.header?.request?.headers?.Host?.[0];
    if (httpHost) params.set("host", httpHost);
    const httpPath = ss.tcpSettings.header?.request?.path?.[0];
    if (httpPath) params.set("path", httpPath);
  }
  const overrideKey = `${ib.panel ?? ""}:${ib.inbound_id ?? ""}`;
  const label = String(overrides?.get(overrideKey) ?? "").trim();
  let display: string;
  if (label) {
    display = label;
  } else {
    const country = String(ib.panel_country ?? "").trim().toUpperCase();
    const ci = country ? COUNTRY_INFO[country] : undefined;
    display = ci ? `${ci.flag} ${ci.name}` : String(ib.panel_name ?? "").trim() || ib.remark;
  }
  return `vless://${effectiveUuid}@${ib.host}:${ib.port}?${params.toString()}#${encodeURIComponent(display)}`;
}

export async function handleSub(req: Request, url: URL): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const parts = url.pathname.split("/").filter(Boolean);
  const slug = parts[parts.length - 1];
  if (!slug || slug === "sub") return new Response("Not found", { status: 404, headers: cors });

  const sub = db.queryEntries(`SELECT id, name, client_email, client_uuid, expiry_ms, total_bytes, hits, sni_whitelist FROM subscriptions WHERE slug = ?`, [slug])[0] as any;
  if (!sub) return new Response("Subscription not found", { status: 404, headers: cors });
  const subDecoded = decodeRow("subscriptions", sub);

  const inbounds = db.queryEntries(`SELECT panel, inbound_id, remark, protocol, port, host, stream_settings, sort_order, created_at FROM subscription_inbounds WHERE subscription_id = ? ORDER BY COALESCE(sort_order, 0) ASC, created_at ASC`, [sub.id]).map((r: any) => decodeRow("subscription_inbounds", r));

  // Pull panel display names + country code.
  const panelInfo = new Map<string, { name: string; country: string }>();
  if (inbounds.length) {
    const slugs = Array.from(new Set(inbounds.map((ib: any) => ib.panel)));
    const ph = slugs.map(() => "?").join(",");
    const rows = db.queryEntries(`SELECT slug, name, country FROM panels WHERE slug IN (${ph})`, slugs);
    rows.forEach((r: any) => panelInfo.set(r.slug, { name: r.name ?? "", country: r.country ?? "" }));
  }
  for (const ib of inbounds as any[]) {
    const info = panelInfo.get(ib.panel);
    ib.panel_name = info?.name ?? "";
    ib.panel_country = info?.country ?? "";
  }

  const overridesMap = new Map<string, string>();
  if (inbounds.length) {
    const panels = Array.from(new Set(inbounds.map((ib: any) => ib.panel)));
    const ids = Array.from(new Set(inbounds.map((ib: any) => ib.inbound_id)));
    const ph1 = panels.map(() => "?").join(","), ph2 = ids.map(() => "?").join(",");
    const ovs = db.queryEntries(`SELECT panel, inbound_id, display_remark FROM inbound_overrides WHERE panel IN (${ph1}) AND inbound_id IN (${ph2})`, [...panels, ...ids]);
    ovs.forEach((o: any) => overridesMap.set(`${o.panel}:${o.inbound_id}`, o.display_remark));
  }

  const whitelist: string[] = Array.isArray((subDecoded as any).sni_whitelist) ? (subDecoded as any).sni_whitelist.filter((s: string) => typeof s === "string" && s.trim().length > 0) : [];
  const lines: string[] = [];
  for (const ib of inbounds as any[]) {
    const sniOverride = whitelist.length ? whitelist[Math.floor(Math.random() * whitelist.length)] : undefined;
    const link = buildVless(sub.client_uuid, sub.client_email, ib, sniOverride, overridesMap);
    if (link) lines.push(link);
  }
  const body = btoa(lines.join("\n"));

  db.query(`UPDATE subscriptions SET hits = hits + 1, last_accessed_at = datetime('now') WHERE id = ?`, [sub.id]);

  let used = 0;
  const lastSnap = db.queryEntries(`SELECT used_bytes FROM traffic_snapshots WHERE subscription_id = ? ORDER BY created_at DESC LIMIT 1`, [sub.id])[0] as any;
  if (lastSnap?.used_bytes != null) used = Number(lastSnap.used_bytes);

  const total = Number(sub.total_bytes ?? 0);
  const expire = sub.expiry_ms ? Math.floor(Number(sub.expiry_ms) / 1000) : 0;
  const profileTitle = "base64:" + btoa(unescape(encodeURIComponent(sub.name)));

  let announceText = "";
  const expiryMs = Number(sub.expiry_ms ?? 0);
  if (!expiryMs) announceText = "♾ Без ограничения по времени";
  else {
    const diff = expiryMs - Date.now();
    if (diff <= 0) announceText = "⛔ Подписка истекла";
    else {
      const d = Math.ceil(diff / 86400000);
      const n10 = d % 10, n100 = d % 100;
      const word = n10 === 1 && n100 !== 11 ? "день" : n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20) ? "дня" : "дней";
      announceText = `⏳ Осталось ${d} ${word}`;
    }
  }
  const announce = "base64:" + btoa(unescape(encodeURIComponent(announceText)));

  return new Response(body, {
    status: 200,
    headers: {
      ...cors,
      "content-type": "text/plain; charset=utf-8",
      "profile-title": profileTitle,
      "profile-update-interval": "12",
      "subscription-userinfo": `upload=0; download=${used}; total=${total}; expire=${expire}`,
      "announce": announce,
      "content-disposition": `attachment; filename=${encodeURIComponent(sub.name)}`,
    },
  });
}