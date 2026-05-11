import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_EXTERNAL_SORT = 1000;
const PINNED_SORT = -1000;
function effectiveExternalSort(perSubSort: number, globalSort: number) {
  const ses = Number.isFinite(perSubSort) ? perSubSort : DEFAULT_EXTERNAL_SORT;
  const glob = Number.isFinite(globalSort) ? globalSort : DEFAULT_EXTERNAL_SORT;
  if (glob < 0) {
    if (ses === DEFAULT_EXTERNAL_SORT) return glob;
    if (ses < 0) return ses;
    return PINNED_SORT + Math.max(1, ses);
  }
  if (ses < 0) return ses;
  return ses !== DEFAULT_EXTERNAL_SORT ? ses : glob;
}

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

function buildVless(
  uuid: string,
  email: string,
  inbound: {
    protocol: string;
    port: number;
    host: string;
    remark: string;
    stream_settings: any;
    panel?: string;
    inbound_id?: number;
  },
  overrides?: Map<string, string>,
  panelInfo?: { name?: string; country?: string },
): string[] {
  if (inbound.protocol !== "vless") return [];
  const ss = inbound.stream_settings ?? {};
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

  const overrideKey = `${inbound.panel ?? ""}:${inbound.inbound_id ?? ""}`;
  const label = String(overrides?.get(overrideKey) ?? "").trim();
  let display: string;
  if (label) {
    display = label;
  } else {
    const country = String(panelInfo?.country ?? "").trim().toUpperCase();
    const ci = country ? COUNTRY_INFO[country] : undefined;
    display = ci ? `${ci.flag} ${ci.name}` : String(panelInfo?.name ?? "").trim() || String((inbound as any).panel_name ?? "").trim() || inbound.remark;
  }

  const external = Array.isArray(ss.externalProxy) ? ss.externalProxy : [];
  if (external.length) {
    return external.map((ep: any) => {
      const next = new URLSearchParams(params);
      const force = firstString(ep.forceTls);
      if (force && force !== "same") next.set("security", force);
      if (force === "none") for (const k of ["alpn", "sni", "fp"]) next.delete(k);
      const remark = firstString(ep.remark) || display;
      return `vless://${effectiveUuid}@${firstString(ep.dest) || inbound.host}:${Number(ep.port ?? inbound.port)}?${next.toString()}#${encodeURIComponent(remark)}`;
    });
  }

  return [`vless://${effectiveUuid}@${inbound.host}:${inbound.port}?${params.toString()}#${encodeURIComponent(display)}`];
}

function inboundDisplay(
  inbound: { panel?: string; inbound_id?: number; remark: string },
  overrides?: Map<string, string>,
  panelInfo?: { name?: string; country?: string },
): string {
  const overrideKey = `${inbound.panel ?? ""}:${inbound.inbound_id ?? ""}`;
  const label = String(overrides?.get(overrideKey) ?? "").trim();
  if (label) return label;
  const country = String(panelInfo?.country ?? "").trim().toUpperCase();
  const ci = country ? COUNTRY_INFO[country] : undefined;
  return ci ? `${ci.flag} ${ci.name}` : String(panelInfo?.name ?? "").trim() || inbound.remark;
}

function buildTrojan(uuid: string, inbound: any, overrides?: Map<string, string>, panelInfo?: { name?: string; country?: string }): string[] {
  if (inbound.protocol !== "trojan") return [];
  const password = String(uuid || "").trim();
  if (!password) return [];
  const ss = inbound.stream_settings ?? {};
  const network = firstString(ss.network) || "tcp";
  const security = firstString(ss.security) || "none";
  const params = new URLSearchParams();
  params.set("type", network);
  applyNetworkParams(params, ss, network);
  if (security === "tls") applyTlsParams(params, ss);
  else if (security === "reality") applyRealityParams(params, ss);
  else params.set("security", "none");
  const display = inboundDisplay(inbound, overrides, panelInfo);
  return [`trojan://${encodeURIComponent(password)}@${inbound.host}:${inbound.port}?${params.toString()}#${encodeURIComponent(display)}`];
}

function buildVmess(uuid: string, inbound: any, overrides?: Map<string, string>, panelInfo?: { name?: string; country?: string }): string[] {
  if (inbound.protocol !== "vmess") return [];
  const id = cleanUuid(uuid);
  if (!id) return [];
  const ss = inbound.stream_settings ?? {};
  const network = firstString(ss.network) || "tcp";
  const security = firstString(ss.security) || "none";
  const display = inboundDisplay(inbound, overrides, panelInfo);
  const cfg: Record<string, any> = {
    v: "2", ps: display, add: inbound.host, port: String(inbound.port), id, aid: "0",
    scy: "auto", net: network, type: "none", host: "", path: "", tls: security === "tls" ? "tls" : "",
  };
  if (network === "ws") {
    cfg.path = String(ss.wsSettings?.path ?? "");
    cfg.host = String(ss.wsSettings?.host ?? ss.wsSettings?.headers?.Host ?? "");
  } else if (network === "grpc") {
    cfg.path = String(ss.grpcSettings?.serviceName ?? "");
  } else if (network === "tcp" && ss.tcpSettings?.header?.type === "http") {
    cfg.type = "http";
    cfg.path = String(ss.tcpSettings.header.request?.path?.[0] ?? "");
    cfg.host = String(ss.tcpSettings.header.request?.headers?.Host?.[0] ?? "");
  }
  if (security === "tls") cfg.sni = String(findDeep(ss.tlsSettings ?? {}, "serverName") ?? "");
  return [`vmess://${base64Utf8(JSON.stringify(cfg))}`];
}

function buildShadowsocks(uuid: string, inbound: any, overrides?: Map<string, string>, panelInfo?: { name?: string; country?: string }): string[] {
  if (inbound.protocol !== "shadowsocks") return [];
  const ss = inbound.stream_settings ?? {};
  const meta = ss._ss ?? {};
  // Single-user inbound: shared password/method stored at link-time.
  // Multi-user (SS-2022): per-client password = uuid, method from inbound._ss.method.
  const password = String(meta.password || uuid || "").trim();
  const method = String(meta.method || "chacha20-ietf-poly1305").trim();
  if (!password || !method) return [];
  const userinfo = btoa(`${method}:${password}`).replace(/=+$/, "");
  const display = inboundDisplay(inbound, overrides, panelInfo);
  return [`ss://${userinfo}@${inbound.host}:${inbound.port}#${encodeURIComponent(display)}`];
}

function buildHysteria2(uuid: string, inbound: any, overrides?: Map<string, string>, panelInfo?: { name?: string; country?: string }): string[] {
  const proto = String(inbound.protocol ?? "").toLowerCase();
  if (proto !== "hysteria2" && proto !== "hysteria") return [];
  const password = String(uuid || "").trim();
  if (!password) return [];
  const ss = inbound.stream_settings ?? {};
  const tls = ss.tlsSettings ?? {};
  const params = new URLSearchParams();
  const sni = firstString(findDeep(tls, "serverName"));
  if (sni) params.set("sni", sni);
  if (Array.isArray(tls.alpn) && tls.alpn.length) params.set("alpn", tls.alpn.join(","));
  const allowInsecure = (tls.settings?.allowInsecure ?? tls.allowInsecure) === true;
  params.set("insecure", allowInsecure ? "1" : "0");
  const obfsPwd = firstString(ss._obfsPassword ?? inbound._obfsPassword ?? ss.obfs?.password);
  if (obfsPwd) {
    params.set("obfs", "salamander");
    params.set("obfs-password", obfsPwd);
  }
  const display = inboundDisplay(inbound, overrides, panelInfo);
  return [`hysteria2://${encodeURIComponent(password)}@${inbound.host}:${inbound.port}?${params.toString()}#${encodeURIComponent(display)}`];
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

const COUNTRY_INFO: Record<string, { flag: string; name: string }> = {
  RU: { flag: "🇷🇺", name: "Россия" },
  CZ: { flag: "🇨🇿", name: "Чехия" },
  DE: { flag: "🇩🇪", name: "Германия" },
  NL: { flag: "🇳🇱", name: "Нидерланды" },
  FR: { flag: "🇫🇷", name: "Франция" },
  GB: { flag: "🇬🇧", name: "Великобритания" },
  UK: { flag: "🇬🇧", name: "Великобритания" },
  US: { flag: "🇺🇸", name: "США" },
  CA: { flag: "🇨🇦", name: "Канада" },
  JP: { flag: "🇯🇵", name: "Япония" },
  SG: { flag: "🇸🇬", name: "Сингапур" },
  TR: { flag: "🇹🇷", name: "Турция" },
  UA: { flag: "🇺🇦", name: "Украина" },
  PL: { flag: "🇵🇱", name: "Польша" },
  FI: { flag: "🇫🇮", name: "Финляндия" },
  SE: { flag: "🇸🇪", name: "Швеция" },
  NO: { flag: "🇳🇴", name: "Норвегия" },
  ES: { flag: "🇪🇸", name: "Испания" },
  IT: { flag: "🇮🇹", name: "Италия" },
  CH: { flag: "🇨🇭", name: "Швейцария" },
  AT: { flag: "🇦🇹", name: "Австрия" },
  KZ: { flag: "🇰🇿", name: "Казахстан" },
  CN: { flag: "🇨🇳", name: "Китай" },
  HK: { flag: "🇭🇰", name: "Гонконг" },
  IN: { flag: "🇮🇳", name: "Индия" },
  BR: { flag: "🇧🇷", name: "Бразилия" },
  AE: { flag: "🇦🇪", name: "ОАЭ" },
  LV: { flag: "🇱🇻", name: "Латвия" },
  LT: { flag: "🇱🇹", name: "Литва" },
  EE: { flag: "🇪🇪", name: "Эстония" },
};

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
      .select("id, name, client_email, client_uuid, expiry_ms, total_bytes, hits, sni_whitelist, raw_links")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !sub) {
      return new Response("Subscription not found", { status: 404, headers: corsHeaders });
    }

    const { data: inbounds } = await supabase
      .from("subscription_inbounds")
      .select("panel, inbound_id, remark, protocol, port, host, stream_settings, sort_order, created_at")
      .eq("subscription_id", sub.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    // Fetch panel display names + country code so we can prefix country/flag to remarks.
    const panelInfoMap = new Map<string, { name: string; country: string; connectionHost: string }>();
    const slugs = Array.from(new Set((inbounds ?? []).map((ib: any) => ib.panel)));
    if (slugs.length) {
      const { data: panelsRows } = await supabase.from("panels").select("slug, name, country, host, public_host, panel_url").in("slug", slugs);
      (panelsRows ?? []).forEach((p: any) => panelInfoMap.set(p.slug, {
        name: p.name ?? "",
        country: p.country ?? "",
        connectionHost: cleanHost(p.public_host || p.host || p.panel_url || ""),
      }));
    }
    for (const ib of (inbounds ?? []) as any[]) {
      const info = panelInfoMap.get(ib.panel);
      ib.panel_name = info?.name ?? "";
      ib.panel_country = info?.country ?? "";
      if (info?.connectionHost) ib.host = info.connectionHost;
    }

    // Load overrides for the panel+inbound pairs used by this subscription
    const overridesMap = new Map<string, string>();
    const pairs = (inbounds ?? []).map((ib: any) => ({ panel: ib.panel, inbound_id: ib.inbound_id }));
    if (pairs.length > 0) {
      const panels = Array.from(new Set(pairs.map((p) => p.panel)));
      const ids = Array.from(new Set(pairs.map((p) => p.inbound_id)));
      const { data: ovs } = await supabase
        .from("inbound_overrides")
        .select("panel, inbound_id, display_remark")
        .in("panel", panels)
        .in("inbound_id", ids);
      (ovs ?? []).forEach((o: any) => overridesMap.set(`${o.panel}:${o.inbound_id}`, o.display_remark));
    }

    const lines: string[] = [];
    const rawLinks = Array.isArray((sub as any).raw_links) ? (sub as any).raw_links : [];
    // Host override: ONLY if explicit ?host= is passed. Otherwise use what was stored
    // when the link was synced from the panel. Avoids per-device host drift.
    const hostOverride = url.searchParams.get("host") || "";
    if (rawLinks.length) {
      for (const link of rawLinks) {
        lines.push(hostOverride ? withHost(String(link), hostOverride) : String(link));
      }
    }
    // Merge own inbounds and attached external subs by sort_order so they can be
    // freely interleaved in the order list.
    type Item = { sort_order: number; created_at: string; lines: string[] };
    const items: Item[] = [];
    for (const ib of inbounds ?? []) {
      items.push({
        sort_order: Number((ib as any).sort_order ?? 0),
        created_at: String((ib as any).created_at ?? ""),
        lines: (() => {
          const pInfo = { name: (ib as any).panel_name, country: (ib as any).panel_country };
          const proto = String((ib as any).protocol || "").toLowerCase();
          if (proto === "vless") return buildVless(sub.client_uuid, sub.client_email, ib as any, overridesMap, pInfo);
          if (proto === "trojan") return buildTrojan(sub.client_uuid, ib as any, overridesMap, pInfo);
          if (proto === "vmess") return buildVmess(sub.client_uuid, ib as any, overridesMap, pInfo);
          if (proto === "shadowsocks") return buildShadowsocks(sub.client_uuid, ib as any, overridesMap, pInfo);
          if (proto === "hysteria2" || proto === "hysteria") return buildHysteria2(sub.client_uuid, ib as any, overridesMap, pInfo);
          return [];
        })(),
      });
    }
    try {
      const { data: linksRows } = await supabase
        .from("subscription_external_subs")
        .select("external_sub_id, sort_order, created_at")
        .eq("subscription_id", sub.id);
      const rows = linksRows ?? [];
      const extIds = Array.from(new Set(rows.map((r: any) => r.external_sub_id).filter(Boolean)));
      if (extIds.length) {
        const { data: exts } = await supabase
          .from("external_subs")
          .select("id, raw_links, sort_order, created_at")
          .in("id", extIds);
        const byId = new Map<string, string[]>();
        const byMeta = new Map<string, { sort_order: number; created_at: string }>();
        for (const e of exts ?? []) {
          const arr = Array.isArray((e as any).raw_links) ? (e as any).raw_links : [];
          byId.set((e as any).id, arr.filter((l: any) => typeof l === "string" && l.trim()).map((l: string) => l.trim()));
          byMeta.set((e as any).id, {
            sort_order: Number((e as any).sort_order ?? 1000),
            created_at: String((e as any).created_at ?? ""),
          });
        }
        for (const r of rows) {
          const ls = byId.get((r as any).external_sub_id) ?? [];
          const meta = byMeta.get((r as any).external_sub_id);
          if (ls.length) {
            const sesSort = Number((r as any).sort_order ?? DEFAULT_EXTERNAL_SORT);
            const sortOrder = effectiveExternalSort(sesSort, meta?.sort_order ?? DEFAULT_EXTERNAL_SORT);
            items.push({
              sort_order: sortOrder,
              created_at: String((r as any).created_at ?? meta?.created_at ?? ""),
              lines: ls,
            });
          }
        }
      }
    } catch (_) { /* ignore */ }
    items.sort((a, b) => (a.sort_order - b.sort_order) || a.created_at.localeCompare(b.created_at));
    for (const it of items) for (const l of it.lines) lines.push(l);

    // ---- Xray JSON (PrimeVPN-style) format ----
    const fmt = (url.searchParams.get("format") || "").toLowerCase();
    if (fmt === "xray" || fmt === "json") {
      const outbounds: any[] = [];
      lines.forEach((link, i) => {
        const ob = linkToOutbound(link, i + 1);
        if (ob) outbounds.push(ob);
      });
      outbounds.push({ tag: "direct", protocol: "freedom" });
      outbounds.push({ tag: "block", protocol: "blackhole" });
      const profile = buildXrayProfile(sub.name, outbounds);
      return new Response(JSON.stringify([profile], null, 2), {
        status: 200,
        headers: {
          ...corsHeaders,
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename=${encodeURIComponent(sub.name)}.json`,
        },
      });
    }

    const body = base64Utf8(lines.join("\n"));

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

    const profileTitle = "base64:" + base64Utf8(sub.name);

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
    const announce = "base64:" + base64Utf8(announceText);

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "content-type": "text/plain; charset=utf-8",
        "profile-title": profileTitle,
        "profile-update-interval": "3",
        "subscription-update-interval": "3",
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