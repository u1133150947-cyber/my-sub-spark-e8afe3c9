// Port of supabase/functions/sub/index.ts to local SQLite.
import { db, decodeRow } from "./db.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

function buildVless(uuid: string, email: string, ib: any, sniOverride?: string, overrides?: Map<string, string>) {
  if (ib.protocol !== "vless") return null;
  const ss = ib.stream_settings ?? {};
  const network = ss.network ?? "tcp", security = ss.security ?? "none";
  const params = new URLSearchParams();
  params.set("type", network); params.set("security", security); params.set("encryption", "none");
  if (security === "reality" && ss.realitySettings) {
    const r = ss.realitySettings, settings = r.settings ?? {};
    const sni = sniOverride || (Array.isArray(r.serverNames) ? r.serverNames[0] : undefined);
    if (sni) params.set("sni", sni);
    if (Array.isArray(r.shortIds) && r.shortIds[0]) params.set("sid", r.shortIds[0]);
    if (settings.publicKey) params.set("pbk", settings.publicKey);
    if (settings.fingerprint) params.set("fp", settings.fingerprint);
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
  if (network === "tcp" && ss.tcpSettings?.header?.type) {
    params.set("headerType", ss.tcpSettings.header.type);
    const httpHost = ss.tcpSettings.header?.request?.headers?.Host?.[0];
    if (httpHost) params.set("host", httpHost);
    const httpPath = ss.tcpSettings.header?.request?.path?.[0];
    if (httpPath) params.set("path", httpPath);
  }
  const overrideKey = `${ib.panel ?? ""}:${ib.inbound_id ?? ""}`;
  const rawRemark = String(overrides?.get(overrideKey) ?? ib.remark ?? "").trim();
  const panelName = String(ib.panel_name ?? "").trim();
  // Strip emoji/punctuation for dedupe so "🇨🇿 Чехия" vs "Чехия" matches.
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[\p{Extended_Pictographic}\p{Emoji_Component}\p{P}\p{S}]/gu, "").replace(/\s+/g, " ").trim();
  // Strip leading country code (cz, ru, de, ...) and separators from the remark.
  let cleanRemark = rawRemark.replace(/^[\s\-—–:|]+/, "").trim();
  cleanRemark = cleanRemark.replace(/^[a-z]{2}[\s\-—–:|]+/i, "").trim();
  let finalRemark = cleanRemark || rawRemark;
  if (panelName) {
    const np = normalize(panelName), nr = normalize(cleanRemark);
    if (!nr) finalRemark = panelName;
    else if (nr === np || nr.startsWith(np)) finalRemark = cleanRemark;
    else finalRemark = `${panelName}\n⤷ ${cleanRemark}`;
  }
  return `vless://${uuid}@${ib.host}:${ib.port}?${params.toString()}#${encodeURIComponent(finalRemark)}`;
}

export async function handleSub(req: Request, url: URL): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const parts = url.pathname.split("/").filter(Boolean);
  const slug = parts[parts.length - 1];
  if (!slug || slug === "sub") return new Response("Not found", { status: 404, headers: cors });

  const sub = db.queryEntries(`SELECT id, name, client_email, client_uuid, expiry_ms, total_bytes, hits, sni_whitelist FROM subscriptions WHERE slug = ?`, [slug])[0] as any;
  if (!sub) return new Response("Subscription not found", { status: 404, headers: cors });
  const subDecoded = decodeRow("subscriptions", sub);

  const inbounds = db.queryEntries(`SELECT panel, inbound_id, remark, protocol, port, host, stream_settings FROM subscription_inbounds WHERE subscription_id = ?`, [sub.id]).map((r: any) => decodeRow("subscription_inbounds", r));

  // Pull panel display names so we can prepend country/flag to the remark.
  const panelNames = new Map<string, string>();
  if (inbounds.length) {
    const slugs = Array.from(new Set(inbounds.map((ib: any) => ib.panel)));
    const ph = slugs.map(() => "?").join(",");
    const rows = db.queryEntries(`SELECT slug, name FROM panels WHERE slug IN (${ph})`, slugs);
    rows.forEach((r: any) => panelNames.set(r.slug, r.name));
  }
  for (const ib of inbounds as any[]) ib.panel_name = panelNames.get(ib.panel) ?? "";

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