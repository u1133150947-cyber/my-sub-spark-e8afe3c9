// Port of supabase/functions/sub/index.ts to local SQLite.
import { db, decodeRow } from "./db.ts";
import { listInbounds, updateClient } from "./x3ui.ts";

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

function cleanHost(value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try { return new URL(raw.includes("://") ? raw : `http://${raw}`).hostname; } catch {}
  return raw.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/^\[|\]$/g, "").replace(/:\d+$/, "");
}

function base64Utf8(value: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(value)));
}

function cleanUuid(...values: unknown[]): string {
  for (const value of values) {
    const candidate = String(value ?? "").trim();
    if (UUID_RE.test(candidate)) return candidate;
  }
  return "";
}

function findDeep(data: any, key: string): any {
  if (!data || typeof data !== "object") return undefined;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findDeep(item, key);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (Object.prototype.hasOwnProperty.call(data, key)) return data[key];
  for (const value of Object.values(data)) {
    const found = findDeep(value, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

function firstString(value: any): string {
  if (Array.isArray(value)) return firstString(value.find((x) => String(x ?? "").trim()));
  return String(value ?? "").trim();
}

function setParam(params: URLSearchParams, key: string, value: any) {
  const v = firstString(value);
  if (v) params.set(key, v);
}

function parseJsonObject(value: any) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch { return {}; }
}

function streamSnapshot(ib: any, clientEmail?: string, fallbackUuid?: string) {
  const stream = parseJsonObject(ib.streamSettings ?? ib.stream_settings);
  const settings = parseJsonObject(ib.settings);
  const clients = Array.isArray(settings.clients) ? settings.clients : [];
  stream._inboundSettings = settings;
  const client = clients.find((c: any) => c?.email === clientEmail) || clients.find((c: any) => c?.id === fallbackUuid);
  if (client) {
    stream._clientUuid = client.id;
    stream._clientFlow = client.flow ?? "";
  }
  stream._inboundListen = ib.listen ?? ib.Listen ?? "";
  return stream;
}

async function refreshInboundsFromPanels(inbounds: any[], sub: any) {
  const panels = Array.from(new Set(inbounds.map((ib: any) => ib.panel).filter(Boolean)));
  await Promise.all(panels.map(async (panel) => {
    try {
      const live = await listInbounds(panel);
      const byId = new Map(live.map((ib: any) => [Number(ib.id), ib]));
      for (const ib of inbounds.filter((x: any) => x.panel === panel)) {
        const fresh = byId.get(Number(ib.inbound_id));
        if (!fresh) continue;
        ib.remark = fresh.remark ?? ib.remark;
        ib.protocol = fresh.protocol ?? ib.protocol;
        ib.port = Number(fresh.port ?? ib.port);
        const snap = streamSnapshot(fresh, ib.client_email, sub.client_uuid);
        ib.stream_settings = snap;
        const desiredFlow = fresh.protocol === "vless" && snap.security === "reality" && snap.network === "tcp" ? "xtls-rprx-vision" : "";
        if (snap._clientUuid && firstString(snap._clientFlow) !== desiredFlow) {
          try {
            await updateClient(panel, Number(ib.inbound_id), {
              id: snap._clientUuid,
              email: ib.client_email,
              expiryTime: Number(sub.expiry_ms ?? 0),
              totalGB: Number(sub.total_bytes ?? 0),
              subId: String(sub.slug ?? "").slice(0, 16),
              flow: desiredFlow,
            });
            snap._clientFlow = desiredFlow;
          } catch {}
        }
      }
    } catch {}
  }));
}

function applyPathAndHost(params: URLSearchParams, settings: any) {
  if (!settings) return;
  setParam(params, "path", settings.path);
  setParam(params, "host", settings.host ?? settings.headers?.Host ?? settings.headers?.host);
}

function buildXhttpExtra(xhttp: any) {
  if (!xhttp || typeof xhttp !== "object") return null;
  const extra: Record<string, any> = {};
  for (const field of ["xPaddingBytes", "xPaddingKey", "xPaddingHeader", "xPaddingPlacement", "xPaddingMethod", "sessionPlacement", "sessionKey", "seqPlacement", "seqKey", "uplinkDataPlacement", "uplinkDataKey", "scMaxEachPostBytes"]) {
    if (typeof xhttp[field] === "string" && xhttp[field]) extra[field] = xhttp[field];
  }
  if (xhttp.xPaddingObfsMode === true) extra.xPaddingObfsMode = true;
  const headers = xhttp.headers;
  if (headers && typeof headers === "object") {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() !== "host") clean[k] = v;
    if (Object.keys(clean).length) extra.headers = clean;
  }
  return Object.keys(extra).length ? extra : null;
}

function applyNetworkParams(params: URLSearchParams, ss: any, network: string) {
  if (network === "tcp") {
    const header = ss.tcpSettings?.header;
    if (header?.type === "http") {
      params.set("headerType", "http");
      setParam(params, "path", header.request?.path?.[0]);
      setParam(params, "host", header.request?.headers?.Host?.[0]);
    }
  } else if (network === "ws") {
    applyPathAndHost(params, ss.wsSettings);
  } else if (network === "grpc") {
    setParam(params, "serviceName", ss.grpcSettings?.serviceName);
    setParam(params, "authority", ss.grpcSettings?.authority);
    if (ss.grpcSettings?.multiMode === true) params.set("mode", "multi");
  } else if (network === "httpupgrade") {
    applyPathAndHost(params, ss.httpupgradeSettings);
  } else if (network === "xhttp" || network === "splithttp") {
    const xhttp = ss.xhttpSettings ?? ss.splithttpSettings;
    applyPathAndHost(params, xhttp);
    setParam(params, "mode", xhttp?.mode);
    setParam(params, "x_padding_bytes", xhttp?.xPaddingBytes);
    const extra = buildXhttpExtra(xhttp);
    if (extra) params.set("extra", JSON.stringify(extra));
  } else if (network === "kcp") {
    setParam(params, "headerType", ss.kcpSettings?.header?.type);
    setParam(params, "seed", ss.kcpSettings?.seed);
  }
}

function applyTlsParams(params: URLSearchParams, ss: any) {
  const t = ss.tlsSettings ?? {};
  params.set("security", "tls");
  setParam(params, "sni", findDeep(t, "serverName"));
  if (Array.isArray(t.alpn) && t.alpn.length) params.set("alpn", t.alpn.join(","));
  setParam(params, "fp", findDeep(t.settings ?? t, "fingerprint"));
}

function applyRealityParams(params: URLSearchParams, ss: any) {
  const r = ss.realitySettings ?? {};
  const settings = r.settings ?? {};
  params.set("security", "reality");
  setParam(params, "sni", findDeep(r, "serverNames") ?? findDeep(r, "serverName"));
  setParam(params, "sid", findDeep(r, "shortIds") ?? findDeep(r, "shortId"));
  setParam(params, "pbk", findDeep(settings, "publicKey") ?? findDeep(r, "publicKey"));
  setParam(params, "fp", findDeep(settings, "fingerprint") ?? findDeep(r, "fingerprint"));
  setParam(params, "pqv", findDeep(settings, "mldsa65Verify") ?? findDeep(r, "mldsa65Verify"));
  params.set("spx", firstString(findDeep(settings, "spiderX") ?? findDeep(r, "spiderX")) || "/");
}

function buildVless(uuid: string, email: string, ib: any, overrides?: Map<string, string>): string[] {
  if (ib.protocol !== "vless") return [];
  const ss = ib.stream_settings ?? {};
  const effectiveUuid = cleanUuid(ss._clientUuid, ss.clientUuid, ss.uuid, ss.id, uuid);
  if (!effectiveUuid) return [];
  const network = firstString(ss.network) || "tcp";
  const security = firstString(ss.security) || "none";
  const params = new URLSearchParams();
  params.set("type", network);
  params.set("encryption", firstString(ss._inboundSettings?.encryption) || "none");
  applyNetworkParams(params, ss, network);
  if (security === "tls") applyTlsParams(params, ss);
  else if (security === "reality") applyRealityParams(params, ss);
  else params.set("security", "none");
  const flow = firstString(ss._clientFlow) || (security === "reality" && network === "tcp" ? "xtls-rprx-vision" : "");
  if (network === "tcp" && flow) params.set("flow", flow);

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

  const external = Array.isArray(ss.externalProxy) ? ss.externalProxy : [];
  if (external.length) {
    return external.map((ep: any) => {
      const next = new URLSearchParams(params);
      const force = firstString(ep.forceTls);
      if (force && force !== "same") next.set("security", force);
      if (force === "none") for (const k of ["alpn", "sni", "fp"]) next.delete(k);
      const remark = firstString(ep.remark) || display;
      return `vless://${effectiveUuid}@${firstString(ep.dest) || ib.host}:${Number(ep.port ?? ib.port)}?${next.toString()}#${encodeURIComponent(remark)}`;
    });
  }

  return [`vless://${effectiveUuid}@${ib.host}:${ib.port}?${params.toString()}#${encodeURIComponent(display)}`];
}

function withHost(link: string, host: string) {
  const h = host.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  if (!h) return link;
  if (/^vmess:\/\//i.test(link)) {
    try {
      const raw = link.slice(link.indexOf("//") + 2).replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(escape(atob(raw + "===".slice((raw.length + 3) % 4))));
      const cfg = JSON.parse(json);
      cfg.add = h;
      return "vmess://" + btoa(unescape(encodeURIComponent(JSON.stringify(cfg)))).replace(/=+$/, "");
    } catch { return link; }
  }
  return link.replace(/^([a-z0-9+.-]+:\/\/[^@\s]+@)(\[[^\]]+\]|[^:/?#\s]+)(:\d+)?/i, (_m, a, _old, port = "") => `${a}${h}${port}`);
}

export async function handleSub(req: Request, url: URL): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const parts = url.pathname.split("/").filter(Boolean);
  const slug = parts[parts.length - 1];
  if (!slug || slug === "sub") return new Response("Not found", { status: 404, headers: cors });

  const sub = db.queryEntries(`SELECT id, slug, name, client_email, client_uuid, expiry_ms, total_bytes, hits, sni_whitelist, raw_links FROM subscriptions WHERE slug = ?`, [slug])[0] as any;
  if (!sub) return new Response("Subscription not found", { status: 404, headers: cors });
  const subDecoded = decodeRow("subscriptions", sub);

  const inbounds = db.queryEntries(`SELECT panel, inbound_id, remark, protocol, port, host, stream_settings, client_email, sort_order, created_at FROM subscription_inbounds WHERE subscription_id = ? ORDER BY COALESCE(sort_order, 0) ASC, created_at ASC`, [sub.id]).map((r: any) => decodeRow("subscription_inbounds", r));

  // Pull panel display names + country code.
  const panelInfo = new Map<string, { name: string; country: string; connectionHost: string }>();
  if (inbounds.length) {
    const slugs = Array.from(new Set(inbounds.map((ib: any) => ib.panel)));
    const ph = slugs.map(() => "?").join(",");
    const rows = db.queryEntries(`SELECT slug, name, country, host, public_host, panel_url FROM panels WHERE slug IN (${ph})`, slugs);
    rows.forEach((r: any) => panelInfo.set(r.slug, { name: r.name ?? "", country: r.country ?? "", connectionHost: cleanHost(r.public_host || r.host || r.panel_url || "") }));
  }
  for (const ib of inbounds as any[]) {
    const info = panelInfo.get(ib.panel);
    ib.panel_name = info?.name ?? "";
    ib.panel_country = info?.country ?? "";
    if (info?.connectionHost) ib.host = info.connectionHost;
  }

  await refreshInboundsFromPanels(inbounds as any[], sub);

  const overridesMap = new Map<string, string>();
  if (inbounds.length) {
    const panels = Array.from(new Set(inbounds.map((ib: any) => ib.panel)));
    const ids = Array.from(new Set(inbounds.map((ib: any) => ib.inbound_id)));
    const ph1 = panels.map(() => "?").join(","), ph2 = ids.map(() => "?").join(",");
    const ovs = db.queryEntries(`SELECT panel, inbound_id, display_remark FROM inbound_overrides WHERE panel IN (${ph1}) AND inbound_id IN (${ph2})`, [...panels, ...ids]);
    ovs.forEach((o: any) => overridesMap.set(`${o.panel}:${o.inbound_id}`, o.display_remark));
  }

  const lines: string[] = [];
  const rawLinks: string[] = Array.isArray((subDecoded as any).raw_links) ? (subDecoded as any).raw_links : [];
  if (rawLinks.length) {
    const hostOverride = url.searchParams.get("host") || "";
    for (const l of rawLinks) lines.push(hostOverride ? withHost(String(l), hostOverride) : String(l));
  }

  for (const ib of inbounds as any[]) {
    lines.push(...buildVless(sub.client_uuid, sub.client_email, ib, overridesMap));
  }

  // Append linked external subs (3rd-party VPN servers) AFTER own inbounds,
  // so the user's main vless servers stay at the top of the list.
  try {
    const linked = db.queryEntries(
      `SELECT e.raw_links FROM subscription_external_subs ses JOIN external_subs e ON e.id = ses.external_sub_id WHERE ses.subscription_id = ?`,
      [sub.id],
    ) as any[];
    for (const r of linked) {
      let arr: any[] = [];
      try { arr = JSON.parse(r.raw_links ?? "[]"); } catch {}
      if (Array.isArray(arr)) for (const l of arr) if (typeof l === "string" && l) lines.push(l);
    }
  } catch {}

  const body = base64Utf8(lines.join("\n"));

  db.query(`UPDATE subscriptions SET hits = hits + 1, last_accessed_at = datetime('now') WHERE id = ?`, [sub.id]);

  let used = 0;
  const lastSnap = db.queryEntries(`SELECT used_bytes FROM traffic_snapshots WHERE subscription_id = ? ORDER BY created_at DESC LIMIT 1`, [sub.id])[0] as any;
  if (lastSnap?.used_bytes != null) used = Number(lastSnap.used_bytes);

  const total = Number(sub.total_bytes ?? 0);
  const expire = sub.expiry_ms ? Math.floor(Number(sub.expiry_ms) / 1000) : 0;
  const profileTitle = "base64:" + base64Utf8(sub.name);

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
  const announce = "base64:" + base64Utf8(announceText);

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