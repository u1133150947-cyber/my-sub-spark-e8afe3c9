import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Plus, Trash2, Link2, Smartphone, Zap, Loader2, Server, RefreshCw, Pencil, X, Check, Share2, ChevronDown, MoreVertical, UserPlus, UserMinus, ArrowUp, ArrowDown, Eye, Download, Upload, FileText, Trash, Search, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { StatsDashboard } from "@/components/StatsDashboard";
import { PanelsManager } from "@/components/PanelsManager";
import { OnlineClients } from "@/components/OnlineClients";
import { UpdatePanel } from "@/components/UpdatePanel";
import { ExternalSubsPanel } from "@/components/ExternalSubsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FLAG_MAP, FLAG_RE } from "@/lib/flags";

// ===== Глобальный лог ошибок/событий =====
type AppLog = { ts: number; level: "error" | "warn" | "info"; source: string; message: string };
const LS_KEY = "app_logs_v1";
const APP_LOGS: AppLog[] = (() => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
})();
const APP_LOG_LISTENERS = new Set<() => void>();
const APP_LOG_MAX = 2000;
let saveTimer: any = null;
function persistLogs() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try { localStorage.setItem(LS_KEY, JSON.stringify(APP_LOGS.slice(-APP_LOG_MAX))); } catch {}
  }, 500);
}
function pushLog(level: AppLog["level"], source: string, message: string) {
  APP_LOGS.push({ ts: Date.now(), level, source, message });
  if (APP_LOGS.length > APP_LOG_MAX) APP_LOGS.splice(0, APP_LOGS.length - APP_LOG_MAX);
  persistLogs();
  APP_LOG_LISTENERS.forEach((fn) => { try { fn(); } catch {} });
}
// Перехват toast.error/warning + console.error/warn + window.onerror
if (typeof window !== "undefined" && !(window as any).__appLogPatched) {
  (window as any).__appLogPatched = true;
  // Verbose console interception only when debug flag активен (localStorage.debug === '1').
  // По умолчанию — НЕ оборачиваем console.error/warn, чтобы не шуметь в проде и не дублировать в audit_log.
  const __debugOn = (() => { try { return localStorage.getItem("debug") === "1"; } catch { return false; } })();
  const origErr = toast.error.bind(toast);
  const origWarn = (toast as any).warning?.bind(toast);
  (toast as any).error = (msg: any, opts?: any) => {
    const text = typeof msg === "string" ? msg : (msg?.message ?? JSON.stringify(msg));
    pushLog("error", "toast", String(text) + (opts?.description ? `\n${opts.description}` : ""));
    return origErr(msg, opts);
  };
  if (origWarn) (toast as any).warning = (msg: any, opts?: any) => {
    const text = typeof msg === "string" ? msg : (msg?.message ?? JSON.stringify(msg));
    pushLog("warn", "toast", String(text) + (opts?.description ? `\n${opts.description}` : ""));
    return origWarn(msg, opts);
  };
  if (__debugOn) {
    const ce = console.error.bind(console);
    console.error = (...args: any[]) => { pushLog("error", "console", args.map((a) => typeof a === "string" ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })()).join(" ")); ce(...args); };
    const cw = console.warn.bind(console);
    console.warn = (...args: any[]) => { pushLog("warn", "console", args.map((a) => typeof a === "string" ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })()).join(" ")); cw(...args); };
  }
  window.addEventListener("error", (e) => pushLog("error", "window", `${e.message} @ ${e.filename}:${e.lineno}`));
  window.addEventListener("unhandledrejection", (e: any) => pushLog("error", "promise", String(e?.reason?.message ?? e?.reason ?? e)));
}

const COUNTRIES: { code: string; flag: string; name: string }[] = [
  { code: "RU", flag: "🇷🇺", name: "Россия" },
  { code: "CZ", flag: "🇨🇿", name: "Чехия" },
  { code: "DE", flag: "🇩🇪", name: "Германия" },
  { code: "NL", flag: "🇳🇱", name: "Нидерланды" },
  { code: "FR", flag: "🇫🇷", name: "Франция" },
  { code: "GB", flag: "🇬🇧", name: "Великобритания" },
  { code: "US", flag: "🇺🇸", name: "США" },
  { code: "CA", flag: "🇨🇦", name: "Канада" },
  { code: "JP", flag: "🇯🇵", name: "Япония" },
  { code: "SG", flag: "🇸🇬", name: "Сингапур" },
  { code: "TR", flag: "🇹🇷", name: "Турция" },
  { code: "UA", flag: "🇺🇦", name: "Украина" },
  { code: "PL", flag: "🇵🇱", name: "Польша" },
  { code: "FI", flag: "🇫🇮", name: "Финляндия" },
  { code: "SE", flag: "🇸🇪", name: "Швеция" },
  { code: "NO", flag: "🇳🇴", name: "Норвегия" },
  { code: "ES", flag: "🇪🇸", name: "Испания" },
  { code: "IT", flag: "🇮🇹", name: "Италия" },
  { code: "CH", flag: "🇨🇭", name: "Швейцария" },
  { code: "AT", flag: "🇦🇹", name: "Австрия" },
  { code: "KZ", flag: "🇰🇿", name: "Казахстан" },
  { code: "CN", flag: "🇨🇳", name: "Китай" },
  { code: "HK", flag: "🇭🇰", name: "Гонконг" },
  { code: "IN", flag: "🇮🇳", name: "Индия" },
  { code: "BR", flag: "🇧🇷", name: "Бразилия" },
  { code: "AE", flag: "🇦🇪", name: "ОАЭ" },
  { code: "LV", flag: "🇱🇻", name: "Латвия" },
  { code: "LT", flag: "🇱🇹", name: "Литва" },
  { code: "EE", flag: "🇪🇪", name: "Эстония" },
];
const countryByCode = (c: string) => COUNTRIES.find((x) => x.code === c.toUpperCase());
const findCountryByPrefix = (s: string) => {
  const trimmed = s.trim();
  for (const c of COUNTRIES) {
    if (trimmed.startsWith(`${c.flag} ${c.name}`)) return c;
    if (trimmed.startsWith(c.flag)) return c;
  }
  return undefined;
};
const buildDisplay = (countryCode: string, label: string) => {
  const c = countryByCode(countryCode);
  const l = label.trim();
  if (c && l) return `${c.flag} ${l}`;
  if (c) return c.flag;
  return l;
};

type Subscription = {
  id: string;
  slug: string;
  name: string;
  client_email: string;
  expiry_ms: number;
  total_bytes: number;
  hits: number;
  created_at: string;
  raw_links?: string[];
};

type InboundClient = { email: string; id?: string; enable?: boolean };
type InboundInfo = { id: number; remark: string; protocol: string; port: number; enable: boolean; clients?: InboundClient[] };
type PanelKey = string;
type PanelMeta = { slug: string; name: string };
type InboundsResp = Record<string, InboundInfo[] | { error: string } | PanelMeta[]> & { _panels?: PanelMeta[] };
type SubInbound = { panel: PanelKey; inbound_id: number; remark: string };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ENV_SUB_BASE = (import.meta.env.VITE_SUB_BASE_URL as string | undefined)?.replace(/\/+$/, "");
const getSubBase = () => {
  if (typeof window !== "undefined") {
    const ls = window.localStorage.getItem("sub_base_url");
    if (ls) return ls.replace(/\/+$/, "");
    if (ENV_SUB_BASE) return ENV_SUB_BASE;
    // On Lovable preview/published domains there's no /sub backend —
    // fall back to the Supabase Edge Function URL so links actually resolve.
    const host = window.location.hostname;
    if (/lovable(project)?\.(app|dev)$/i.test(host) || /\.lovable\.app$/i.test(host)) {
      return `${SUPABASE_URL}/functions/v1/sub`;
    }
    return `${window.location.origin}/sub`;
  }
  return `${SUPABASE_URL}/functions/v1/sub`;
};
const subUrl = (slug: string) => `${getSubBase()}/${slug}`;
const happUrl = (slug: string) => `happ://add/${encodeURIComponent(subUrl(slug))}`;


const PRESETS: { label: string; days: number; gb: number }[] = [
  { label: "Trial 3 дня", days: 3, gb: 5 },
  { label: "1 месяц", days: 30, gb: 0 },
  { label: "3 месяца", days: 90, gb: 0 },
  { label: "6 месяцев", days: 180, gb: 0 },
  { label: "1 год", days: 365, gb: 0 },
  { label: "Безлимит", days: 0, gb: 0 },
];

const CLIENT_LINKS: { label: string; emoji: string; build: (u: string) => string }[] = [
  { label: "Happ", emoji: "📱", build: (u) => `happ://add/${encodeURIComponent(u)}` },
  { label: "v2RayTun", emoji: "🚀", build: (u) => `v2raytun://import/${encodeURIComponent(u)}` },
  { label: "Streisand", emoji: "🌊", build: (u) => `streisand://import/${u}` },
  { label: "Shadowrocket", emoji: "🚀", build: (u) => `sub://${btoa(u).replace(/=+$/, "")}` },
  { label: "Hiddify", emoji: "🛡️", build: (u) => `hiddify://install-config?url=${encodeURIComponent(u)}` },
  { label: "Clash Meta", emoji: "⚡", build: (u) => `clash://install-config?url=${encodeURIComponent(u)}` },
  { label: "NekoBox", emoji: "🐱", build: (u) => `sn://subscription?url=${encodeURIComponent(u)}` },
];

const DEFAULT_EXTERNAL_SORT = 1000;
const PINNED_SORT = -1000;
const isPinnedSort = (v: number) => Number.isFinite(v) && v < 0;
const effectiveExternalSort = (perSubSort: number, globalSort: number) => {
  if (isPinnedSort(globalSort)) {
    if (perSubSort === DEFAULT_EXTERNAL_SORT) return globalSort;
    if (isPinnedSort(perSubSort)) return perSubSort;
    return PINNED_SORT + Math.max(1, perSubSort);
  }
  if (isPinnedSort(perSubSort)) return perSubSort;
  return perSubSort !== DEFAULT_EXTERNAL_SORT ? perSubSort : globalSort;
};

const Index = () => {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [inbounds, setInbounds] = useState<InboundsResp | null>(null);
  const [loadingInbounds, setLoadingInbounds] = useState(false);
  const [name, setName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [days, setDays] = useState(30);
  const [totalGB, setTotalGB] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [activeQr, setActiveQr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDays, setEditDays] = useState<string>("");
  const [editGB, setEditGB] = useState<string>("");
  const [editSlug, setEditSlug] = useState<string>("");
  const [editSelected, setEditSelected] = useState<Set<string>>(new Set());
  const [editExisting, setEditExisting] = useState<Set<string>>(new Set());
  const [editOrder, setEditOrder] = useState<string[]>([]);
  const [editSniText, setEditSniText] = useState<string>("");
  const [editExternals, setEditExternals] = useState<Record<string, { name: string; emoji: string; raw_links: string[]; sort_order: number }>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("subs");
  const [subsSelected, setSubsSelected] = useState<Set<string>>(new Set());
  const [subsSearch, setSubsSearch] = useState<string>("");
  const [subsSort, setSubsSort] = useState<string>("created_desc");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [emailToSubId, setEmailToSubId] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [renameTarget, setRenameTarget] = useState<{ panel: string; inboundId: number; original: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameCountry, setRenameCountry] = useState("");
  const [renameLabel, setRenameLabel] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rawImportOpen, setRawImportOpen] = useState(false);
  const [rawImportText, setRawImportText] = useState("");
  const [rawImportName, setRawImportName] = useState("");
  const [rawImportDomain, setRawImportDomain] = useState("");
  const [rawImporting, setRawImporting] = useState(false);
  const [importLog, setImportLog] = useState<string[]>([]);
  const [importLogOpen, setImportLogOpen] = useState(false);
  const [appLogs, setAppLogs] = useState<AppLog[]>(APP_LOGS.slice());
  useEffect(() => {
    const fn = () => setAppLogs(APP_LOGS.slice());
    APP_LOG_LISTENERS.add(fn);
    return () => { APP_LOG_LISTENERS.delete(fn); };
  }, []);

  // ===== Logs UI state =====
  type ServerLog = { id: string; ts: string; level: string; action: string; panel_slug: string | null; subscription_id: string | null; status: string | null; duration_ms: number | null; error: string | null; request_id: string | null; meta: any };
  const [serverLogs, setServerLogs] = useState<ServerLog[]>([]);
  const [logSource, setLogSource] = useState<"client" | "server" | "all">("all");
  const [logLevel, setLogLevel] = useState<"all" | "error" | "warn" | "info">("all");
  const [logSearch, setLogSearch] = useState("");
  const [logGroup, setLogGroup] = useState(true);
  const [logHours, setLogHours] = useState(24);
  const [serverLogsLoading, setServerLogsLoading] = useState(false);
  const [lastSeenLogTs, setLastSeenLogTs] = useState<number>(() => {
    try { return Number(localStorage.getItem("logs_last_seen") || "0"); } catch { return 0; }
  });

  const loadServerLogs = async () => {
    setServerLogsLoading(true);
    try {
      const params = new URLSearchParams({ hours: String(logHours), limit: "500" });
      if (logLevel !== "all") params.set("level", logLevel);
      if (logSearch.trim()) params.set("q", logSearch.trim());
      const { data, error } = await supabase.functions.invoke(`panel?action=auditLog&${params.toString()}`, { method: "GET" });
      if (error) throw error;
      setServerLogs(((data as any)?.logs ?? []) as ServerLog[]);
    } catch (e: any) {
      pushLog("error", "auditLog", e?.message ?? String(e));
    } finally {
      setServerLogsLoading(false);
    }
  };

  const panelMeta: PanelMeta[] = (((inbounds?._panels as PanelMeta[]) ?? [])
    .filter((p: any) => p?.slug && p.slug !== "null" && p.slug !== "undefined"));
  const panelLabel = (slug: string) => panelMeta.find((p) => p.slug === slug)?.name ?? slug;
  const inboundLabel = (panel: string, id: number, fallback: string) =>
    overrides[`${panel}:${id}`] || fallback || `inbound #${id}`;

  const loadOverrides = async () => {
    const { data } = await supabase
      .from("inbound_overrides")
      .select("panel, inbound_id, display_remark");
    const m: Record<string, string> = {};
    (data ?? []).forEach((r: any) => { m[`${r.panel}:${r.inbound_id}`] = r.display_remark; });
    setOverrides(m);
  };

  const openRename = (panel: string, inboundId: number, original: string) => {
    setRenameTarget({ panel, inboundId, original });
    const existing = overrides[`${panel}:${inboundId}`] || "";
    const matched = existing ? findCountryByPrefix(existing) : undefined;
    if (matched) {
      setRenameCountry(matched.code);
      let rest = existing.trim();
      if (rest.startsWith(`${matched.flag} ${matched.name}`)) rest = rest.slice(`${matched.flag} ${matched.name}`.length);
      else if (rest.startsWith(matched.flag)) rest = rest.slice(matched.flag.length);
      rest = rest.replace(/^\s*[—\-–]\s*/, "").trim();
      setRenameLabel(rest);
    } else {
      setRenameCountry("");
      setRenameLabel(existing);
    }
    setRenameValue(existing);
  };

  const saveRename = async () => {
    if (!renameTarget) return;
    const { panel, inboundId } = renameTarget;
    const val = buildDisplay(renameCountry, renameLabel);
    setRenameSaving(true);
    try {
      if (!val || val === renameTarget.original) {
        await supabase.from("inbound_overrides").delete().eq("panel", panel).eq("inbound_id", inboundId);
        toast.success("Название сброшено");
      } else {
        const { error } = await supabase
          .from("inbound_overrides")
          .upsert({ panel, inbound_id: inboundId, display_remark: val }, { onConflict: "panel,inbound_id" });
        if (error) throw error;
        toast.success("Название обновлено — применится при следующем обновлении подписки");
      }
      await loadOverrides();
      setRenameTarget(null);
    } catch (e: any) {
      toast.error("Ошибка: " + (e?.message ?? e));
    } finally {
      setRenameSaving(false);
    }
  };

  const loadEmailMap = async () => {
    const { data } = await supabase
      .from("subscription_inbounds")
      .select("client_email, subscription_id");
    const map: Record<string, string> = {};
    (data ?? []).forEach((r: any) => { if (r.client_email && r.subscription_id) map[r.client_email] = r.subscription_id; });
    setEmailToSubId(map);
  };

  const openClientEdit = async (email: string) => {
    const subId = emailToSubId[email];
    if (!subId) return toast.error("Клиент не привязан к подписке в базе");
    const sub = subs.find((s) => s.id === subId);
    if (!sub) return toast.error("Подписка не найдена");
    setActiveTab("subs");
    await openEdit(sub);
    setTimeout(() => {
      document.getElementById(`sub-${sub.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const bulkAdd = async (panel: PanelKey, inboundId: number, remark: string) => {
    if (!confirm(`Добавить «${remark}» ВСЕМ существующим клиентам?`)) return;
    const key = `add:${panel}:${inboundId}`;
    setBulkBusy(key);
    try {
      const { data, error } = await supabase.functions.invoke("panel?action=bulkAddInbound", {
        method: "POST",
        body: { panel, inboundId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Добавлено клиентам: ${data.created}${data.errors?.length ? `, ошибок: ${data.errors.length}` : ""}`);
      pushLog("info", "bulkAdd", `panel=${panel} inbound=${inboundId} created=${data.created} errors=${data.errors?.length ?? 0}`);
      if (data?.errors?.length) {
        for (const er of data.errors) {
          pushLog("error", "bulkAdd", `sub=${er.sub ?? "?"}: ${er.error ?? JSON.stringify(er)}`);
        }
      }
      loadSubs();
    } catch (e: any) {
      toast.error("Ошибка: " + (e?.message ?? e));
    } finally {
      setBulkBusy(null);
    }
  };

  const bulkRemove = async (panel: PanelKey, inboundId: number, remark: string) => {
    if (!confirm(`Убрать «${remark}» у ВСЕХ клиентов? Они потеряют доступ к этому серверу.`)) return;
    const key = `rm:${panel}:${inboundId}`;
    setBulkBusy(key);
    try {
      const { data, error } = await supabase.functions.invoke("panel?action=bulkRemoveInbound", {
        method: "POST",
        body: { panel, inboundId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Убрано у клиентов: ${data.removed}${data.errors?.length ? `, ошибок: ${data.errors.length}` : ""}`);
      pushLog("info", "bulkRemove", `panel=${panel} inbound=${inboundId} removed=${data.removed} errors=${data.errors?.length ?? 0}`);
      if (data?.errors?.length) {
        for (const er of data.errors) {
          pushLog("error", "bulkRemove", `sub=${er.sub ?? "?"}: ${er.error ?? JSON.stringify(er)}`);
        }
      }
      loadSubs();
    } catch (e: any) {
      toast.error("Ошибка: " + (e?.message ?? e));
    } finally {
      setBulkBusy(null);
    }
  };

  const loadSubs = async () => {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("id, slug, name, client_email, expiry_ms, total_bytes, hits, created_at, raw_links")
      .order("created_at", { ascending: false });
    if (error) return toast.error("Не удалось загрузить подписки");
    setSubs(((data ?? []) as any[]).map((s) => ({
      ...s,
      raw_links: Array.isArray(s.raw_links) ? s.raw_links : [],
    })));
  };

  const loadInbounds = async () => {
    setLoadingInbounds(true);
    try {
      const __dbg = (() => { try { return localStorage.getItem("debug") === "1"; } catch { return false; } })();
      // Прямой fetch — обход возможных проблем supabase.functions.invoke с query-string
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
      const apikey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
      const fnBase = `${(import.meta.env.VITE_SUPABASE_URL as string).replace(/\/+$/, "")}/functions/v1`;
      const url = `${fnBase}/panel?action=inbounds`;
      if (__dbg) pushLog("info", "loadInbounds", `GET ${url}`);
      const r = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${token}`, apikey } });
      const text = await r.text();
      if (__dbg) pushLog("info", "loadInbounds", `HTTP ${r.status}, body len=${text.length}, head="${text.slice(0,200)}"`);
      let data: any = null;
      try { data = JSON.parse(text); } catch (e: any) {
        pushLog("error", "loadInbounds", `JSON parse error: ${e?.message ?? e}`);
        throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
      }
      if (!r.ok) { pushLog("error", "loadInbounds", `HTTP ${r.status}`); throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`); }
      if (data && typeof data === "object") {
        for (const k of Object.keys(data)) {
          const v: any = (data as any)[k];
          if (v && typeof v === "object" && !Array.isArray(v) && k !== "_panels" && v.error) {
            pushLog("error", "panel:" + k, `inbounds: ${v.error}`);
          }
        }
      }
      const keys = Object.keys(data ?? {}).filter((k) => k !== "_panels" && Array.isArray((data as any)[k]) && k && k !== "null" && k !== "undefined");
      const meta = Array.isArray((data as any)?._panels)
        ? (data as any)._panels.filter((p: any) => p?.slug && p.slug !== "null" && p.slug !== "undefined")
        : [];
      if (__dbg) pushLog("info", "loadInbounds", `raw _panels=${JSON.stringify(((data as any)?._panels) ?? null)}, keys=${JSON.stringify(keys)}`);
      setInbounds({ ...(data ?? {}), _panels: meta.length ? meta : keys.map((slug) => ({ slug, name: slug })) });
      const totalIb = keys.reduce((n, k) => n + (Array.isArray((data as any)[k]) ? (data as any)[k].length : 0), 0);
      if (__dbg) pushLog("info", "loadInbounds", `панелей=${meta.length || keys.length}, inbound'ов=${totalIb}`);
    } catch (e: any) {
      toast.error("Ошибка загрузки inbound'ов: " + (e?.message ?? e));
    } finally {
      setLoadingInbounds(false);
    }
  };

  useEffect(() => {
    loadSubs();
    loadOverrides();
  }, []);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const create = async () => {
    if (!name.trim()) return toast.error("Введите имя клиента");
    if (selected.size === 0) return toast.error("Выберите хотя бы один inbound");
    const desiredSlug = createSlug.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (createSlug.trim() && desiredSlug.length < 4) return toast.error("URL должен быть минимум 4 символа (a-z 0-9)");

    const selections = Array.from(selected).map((s) => {
      const [panel, id] = s.split(":");
      return { panel: panel as PanelKey, inboundId: Number(id) };
    });

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("panel?action=create", {
        method: "POST",
        body: { name: name.trim(), days, totalGB, selections, ...(desiredSlug ? { slug: desiredSlug } : {}) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Создано на ${data.created.length} серверах`);
      if (data.errors?.length) {
        toast.warning(`Ошибки: ${data.errors.length}`, {
          description: data.errors.map((e: any) => `${e.panel}#${e.inboundId}: ${e.error}`).join("\n"),
        });
      }
      setName("");
      setCreateSlug("");
      setSelected(new Set());
      loadSubs();
    } catch (e: any) {
      toast.error("Ошибка: " + (e?.message ?? e));
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить подписку и клиента из всех панелей?")) return;
    try {
      const { data, error } = await supabase.functions.invoke("panel?action=delete", {
        method: "POST",
        body: { id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Удалено");
      loadSubs();
    } catch (e: any) {
      toast.error("Ошибка удаления: " + (e?.message ?? e));
    }
  };

  const bulkDeleteSubs = async () => {
    const ids = Array.from(subsSelected);
    if (!ids.length) return;
    if (!confirm(`Удалить ${ids.length} подписок и всех клиентов в панелях?`)) return;
    setBulkDeleting(true);
    let ok = 0, fail = 0;
    for (const id of ids) {
      try {
        const { data, error } = await supabase.functions.invoke("panel?action=delete", {
          method: "POST",
          body: { id },
        });
        if (error || data?.error) throw new Error(error?.message || data?.error);
        ok++;
      } catch (e: any) {
        fail++;
        pushLog("error", "bulkDelete", `${id}: ${e?.message ?? e}`);
      }
    }
    setBulkDeleting(false);
    setSubsSelected(new Set());
    if (fail) toast.error(`Удалено ${ok}, ошибок ${fail}`);
    else toast.success(`Удалено: ${ok}`);
    loadSubs();
  };

  const openEdit = async (s: Subscription) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditDays("");
    setEditGB("");
    setEditSlug(s.slug);
    if (!inbounds) loadInbounds();
    // load current whitelist
    const { data: subRow } = await supabase
      .from("subscriptions")
      .select("sni_whitelist")
      .eq("id", s.id)
      .maybeSingle();
    const wl = (subRow as any)?.sni_whitelist as string[] | null;
    setEditSniText(Array.isArray(wl) ? wl.join("\n") : "");
    const { data } = await supabase
      .from("subscription_inbounds")
      .select("panel, inbound_id, remark, sort_order, created_at")
      .eq("subscription_id", s.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    const inboundItems = (data ?? []).map((l: any) => ({
      key: `${l.panel}:${l.inbound_id}`,
      sort_order: Number(l.sort_order ?? 0),
    }));

    // Load attached external subs (3rd-party) so they can be ordered together
    const { data: extLinks } = await supabase
      .from("subscription_external_subs")
      .select("external_sub_id, sort_order, created_at")
      .eq("subscription_id", s.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    const extIds = (extLinks ?? []).map((r: any) => r.external_sub_id);
    const extMap: Record<string, { name: string; emoji: string; raw_links: string[]; sort_order: number }> = {};
    const extMeta: Record<string, number> = {};
    if (extIds.length) {
      const { data: exts } = await supabase
        .from("external_subs")
        .select("id, name, emoji, raw_links, sort_order")
        .in("id", extIds);
      for (const e of exts ?? []) {
        extMap[(e as any).id] = {
          name: (e as any).name ?? "",
          emoji: (e as any).emoji ?? "🌐",
          raw_links: Array.isArray((e as any).raw_links) ? (e as any).raw_links : [],
          sort_order: Number((e as any).sort_order ?? DEFAULT_EXTERNAL_SORT),
        };
        extMeta[(e as any).id] = Number((e as any).sort_order ?? DEFAULT_EXTERNAL_SORT);
      }
    }
    setEditExternals(extMap);
    const extItems = (extLinks ?? []).map((r: any) => {
      const sesSort = Number(r.sort_order ?? DEFAULT_EXTERNAL_SORT);
      const effective = effectiveExternalSort(sesSort, extMeta[r.external_sub_id] ?? DEFAULT_EXTERNAL_SORT);
      return {
        key: `ext:${r.external_sub_id}`,
        sort_order: effective,
        _ses_sort: sesSort,
        _global_sort: extMeta[r.external_sub_id] ?? DEFAULT_EXTERNAL_SORT,
      };
    });

    const allItems = [...inboundItems, ...extItems].sort((a, b) => a.sort_order - b.sort_order);
    const orderedKeys = allItems.map((it) => it.key);
    const keys = new Set(orderedKeys);
    setEditExisting(keys);
    setEditSelected(new Set(keys));
    setEditOrder(orderedKeys);

    // === DEBUG: подробный лог открытия редактора порядка ===
    console.group(`[ORDER-EDITOR OPEN] sub=${s.slug} (${s.id})`);
    console.log("inbounds (raw из БД):", data);
    console.log("inboundItems:", inboundItems);
    console.log("subscription_external_subs (raw из БД):", extLinks);
    console.log("external_subs.sort_order (глобальные):", extMeta);
    console.log("extItems (с применённым fallback):", extItems);
    console.log("итоговый orderedKeys (что увидит пользователь):", orderedKeys);
    console.groupEnd();
    try {
      await supabase.from("audit_log").insert({
        action: "order_editor_open",
        subscription_id: s.id,
        level: "debug",
        meta: {
          slug: s.slug,
          inboundItems,
          extLinks,
          extMeta,
          extItems,
          orderedKeys,
        } as any,
      } as any);
    } catch (e) { console.warn("audit_log insert failed", e); }
  };

  const closeEdit = () => {
    setEditingId(null);
    setEditSelected(new Set());
    setEditExisting(new Set());
    setEditOrder([]);
    setEditSniText("");
    setEditExternals({});
  };

  const toggleEdit = (key: string) => {
    setEditSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    setEditOrder((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      return [...prev, key];
    });
  };

  const moveOrder = (key: string, dir: -1 | 1) => {
    setEditOrder((prev) => {
      const idx = prev.indexOf(key);
      if (idx < 0) return prev;
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[idx], next[j]] = [next[j], next[idx]];
      console.group(`[ORDER-EDITOR MOVE] key=${key} dir=${dir}`);
      console.log("before:", prev);
      console.log("after :", next);
      console.log(`swap indexes: ${idx} <-> ${j}`);
      console.groupEnd();
      return next;
    });
  };

  const persistEditOrder = async (subscriptionId: string) => {
    const orderedSelected = editOrder.filter((k) => editSelected.has(k));
    if (!orderedSelected.length) return;
    const writes: Array<{ key: string; table: string; sort_order: number; ok: boolean; error?: string }> = [];
    console.group(`[ORDER-EDITOR SAVE] sub=${subscriptionId} count=${orderedSelected.length}`);
    console.log("orderedSelected:", orderedSelected);
    for (let i = 0; i < orderedSelected.length; i++) {
      const k = orderedSelected[i];
      // Use spaced values (10,20,30...) so persisted positions are unambiguous
      // and never collide with the default 1000 or with the legacy 0 default
      // on subscription_inbounds. This guarantees the merge sort in the
      // subscription renderer respects the editor order exactly.
      const pos = (i + 1) * 10;
      if (k.startsWith("ext:")) {
        const extId = k.slice(4);
        const { error, data: upd } = await supabase
          .from("subscription_external_subs")
          .update({ sort_order: pos } as any)
          .eq("subscription_id", subscriptionId)
          .eq("external_sub_id", extId)
          .select();
        writes.push({ key: k, table: "subscription_external_subs", sort_order: pos, ok: !error, error: error?.message });
        console.log(`  [${i}] UPDATE ses ext=${extId} -> sort_order=${pos}`, { error, updated: upd });
        if (error) throw error;
      } else {
        const [panel, idStr] = k.split(":");
        const { error, data: upd } = await supabase
          .from("subscription_inbounds")
          .update({ sort_order: pos } as any)
          .eq("subscription_id", subscriptionId)
          .eq("panel", panel)
          .eq("inbound_id", Number(idStr))
          .select();
        writes.push({ key: k, table: "subscription_inbounds", sort_order: pos, ok: !error, error: error?.message });
        console.log(`  [${i}] UPDATE sub_inb ${panel}:${idStr} -> sort_order=${pos}`, { error, updated: upd });
        if (error) throw error;
      }
    }
    // Verify: re-read after save
    const { data: verSes } = await supabase
      .from("subscription_external_subs")
      .select("external_sub_id, sort_order")
      .eq("subscription_id", subscriptionId)
      .order("sort_order", { ascending: true });
    const { data: verInb } = await supabase
      .from("subscription_inbounds")
      .select("panel, inbound_id, sort_order")
      .eq("subscription_id", subscriptionId)
      .order("sort_order", { ascending: true });
    console.log("VERIFY subscription_external_subs:", verSes);
    console.log("VERIFY subscription_inbounds:", verInb);
    console.groupEnd();
    try {
      await supabase.from("audit_log").insert({
        action: "order_editor_save",
        subscription_id: subscriptionId,
        level: "debug",
        meta: { orderedSelected, writes, verifySes: verSes, verifyInb: verInb } as any,
      } as any);
    } catch (e) { console.warn("audit_log insert failed", e); }
  };

  const saveEdit = async (s: Subscription) => {
    setSavingEdit(true);
    try {
      // Compute additions and removals
      const toAdd: { panel: PanelKey; inboundId: number }[] = [];
      const toRemove: { panel: PanelKey; inboundId: number }[] = [];
      const extToRemove: string[] = [];
      editSelected.forEach((k) => {
        if (!editExisting.has(k)) {
          if (k.startsWith("ext:")) return; // can't add new ext from this UI
          const [p, id] = k.split(":");
          toAdd.push({ panel: p as PanelKey, inboundId: Number(id) });
        }
      });
      editExisting.forEach((k) => {
        if (!editSelected.has(k)) {
          if (k.startsWith("ext:")) {
            extToRemove.push(k.slice(4));
            return;
          }
          const [p, id] = k.split(":");
          toRemove.push({ panel: p as PanelKey, inboundId: Number(id) });
        }
      });

      // Update name/days/GB
      const updateBody: any = { id: s.id };
      if (editName.trim() && editName.trim() !== s.name) updateBody.name = editName.trim();
      if (editDays !== "") updateBody.days = Number(editDays);
      if (editGB !== "") updateBody.totalGB = Number(editGB);
      const newSlug = editSlug.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      if (newSlug && newSlug !== s.slug) {
        if (newSlug.length < 4) throw new Error("URL должен быть минимум 4 символа (a-z 0-9)");
        updateBody.slug = newSlug;
      }
      if (Object.keys(updateBody).length > 1) {
        const { data, error } = await supabase.functions.invoke("panel?action=update", {
          method: "POST",
          body: updateBody,
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (data?.errors?.length) {
          toast.warning(`Обновление: ошибки на ${data.errors.length} серверах`);
        }
      }

      // Remove inbounds
      for (const r of toRemove) {
        const { data, error } = await supabase.functions.invoke("panel?action=removeInbound", {
          method: "POST",
          body: { id: s.id, panel: r.panel, inboundId: r.inboundId },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }

      // Detach external subs
      for (const extId of extToRemove) {
        const { error } = await supabase
          .from("subscription_external_subs")
          .delete()
          .eq("subscription_id", s.id)
          .eq("external_sub_id", extId);
        if (error) throw error;
      }

      // Add inbounds
      if (toAdd.length) {
        const { data, error } = await supabase.functions.invoke("panel?action=addInbounds", {
          method: "POST",
          body: { id: s.id, selections: toAdd },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (data?.errors?.length) {
          toast.warning(`Добавление: ошибки на ${data.errors.length} серверах`, {
            description: data.errors.map((e: any) => `${e.panel}#${e.inboundId}: ${e.error}`).join("\n"),
          });
        }
      }

      await persistEditOrder(s.id);

      toast.success("Подписка обновлена");
      closeEdit();
      loadSubs();
    } catch (e: any) {
      toast.error("Ошибка: " + (e?.message ?? e));
    } finally {
      setSavingEdit(false);
    }
  };

  const saveOrder = async (s: Subscription) => {
    try {
      await persistEditOrder(s.id);
      toast.success("Порядок сохранён");
    } catch (e: any) {
      toast.error("Ошибка: " + (e?.message ?? e));
    }
  };

  const saveSniWhitelist = async (s: Subscription) => {
    const list = editSniText
      .split(/[\s,]+/)
      .map((x) => x.trim().toLowerCase())
      .filter((x) => x.length > 0 && /^[a-z0-9.\-]+\.[a-z]{2,}$/.test(x));
    const { error } = await supabase
      .from("subscriptions")
      .update({ sni_whitelist: list } as any)
      .eq("id", s.id);
    if (error) {
      toast.error("Ошибка: " + error.message);
      return;
    }
    toast.success(list.length ? `SNI whitelist: ${list.length} доменов` : "SNI whitelist очищен");
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Скопировано");
  };

  const fmtExpire = (ms: number) => {
    if (!ms) return "∞";
    const d = new Date(ms);
    return d.toLocaleDateString("ru-RU");
  };
  const fmtGB = (b: number) => (b ? `${(b / 1024 / 1024 / 1024).toFixed(0)} GB` : "∞");

  const decodeMaybeBase64 = (text: string) => {
    const trimmed = text.trim();
    if (/^(vless|vmess|trojan|ss):\/\//im.test(trimmed)) return trimmed;
    const compact = trimmed.replace(/\s+/g, "");
    try {
      const normalized = compact.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "===".slice((normalized.length + 3) % 4);
      return decodeURIComponent(escape(atob(padded)));
    } catch {
      return trimmed;
    }
  };

  const extractConfigLinks = (text: string) =>
    decodeMaybeBase64(text)
      .split(/[\r\n]+/)
      .map((x) => x.trim())
      .filter((x) => /^(vless|vmess|trojan|ss):\/\//i.test(x));

  const importRawSubscription = async () => {
    const links = extractConfigLinks(rawImportText);
    if (!links.length) return toast.error("Не нашёл vless/vmess/trojan/ss ссылки в тексте");
    const name = rawImportName.trim() || `Импорт ${new Date().toLocaleDateString("ru-RU")}`;
    setRawImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("panel?action=importRaw", {
        method: "POST",
        body: { name, links, domain: rawImportDomain.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Создана подписка из текста");
      setRawImportOpen(false);
      setRawImportText("");
      setRawImportName("");
      setRawImportDomain("");
      loadSubs();
    } catch (e: any) {
      toast.error("Ошибка импорта текстом: " + (e?.message ?? e));
    } finally {
      setRawImporting(false);
    }
  };

  const exportSubs = async () => {
    try {
      const { data: subsData, error: e1 } = await supabase
        .from("subscriptions")
        .select("id, slug, name, client_email, expiry_ms, total_bytes, hits, created_at, sni_whitelist");
      if (e1) throw e1;
      const { data: linksData, error: e2 } = await supabase
        .from("subscription_inbounds")
        .select("subscription_id, panel, inbound_id, remark, sort_order");
      if (e2) throw e2;
      const byId: Record<string, any[]> = {};
      (linksData ?? []).forEach((r: any) => {
        (byId[r.subscription_id] ||= []).push({
          panel: r.panel, inbound_id: r.inbound_id, remark: r.remark, sort_order: r.sort_order,
        });
      });
      const out = {
        version: 1,
        exported_at: new Date().toISOString(),
        subscriptions: (subsData ?? []).map((s: any) => ({
          slug: s.slug,
          name: s.name,
          client_email: s.client_email,
          expiry_ms: s.expiry_ms,
          total_bytes: s.total_bytes,
          sni_whitelist: s.sni_whitelist ?? [],
          inbounds: byId[s.id] ?? [],
        })),
      };
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `subscriptions-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Экспортировано: ${out.subscriptions.length}`);
    } catch (e: any) {
      toast.error("Ошибка экспорта: " + (e?.message ?? e));
    }
  };

  const importSubs = async (file: File) => {
    setImporting(true);
    const L: string[] = [];
    const log = (s: string) => { L.push(s); console.log("[import]", s); };
    setImportLog([]);
    log(`=== Импорт подписок ${new Date().toISOString()} ===`);
    log(`Файл: ${file.name} (${file.size} bytes)`);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list: any[] = parsed?.subscriptions ?? (Array.isArray(parsed) ? parsed : []);
      log(`Найдено в файле: ${list.length} подписок`);
      if (!list.length) throw new Error("Пустой файл импорта");
      if (!confirm(`Импортировать ${list.length} подписок? Будут созданы новые клиенты на панелях.`)) {
        setImporting(false);
        return;
      }
      const fallbackAll = confirm(
        "Если inbound не найден по имени — создать подписку на ВСЕХ доступных inbound'ах текущих панелей?\n\nOK = да (рекомендуется при разных названиях панелей)\nОтмена = пропускать такие подписки"
      );
      log(`fallbackAll=${fallbackAll}`);
      const detachedIfNoInbound = confirm(
        "Если inbound'ы текущих панелей не загрузились или не совпали — всё равно создать подписки БЕЗ привязки к панелям?\n\nOK = да, потом добавите панели вручную в редактировании подписки\nОтмена = пропускать такие подписки"
      );
      log(`detachedIfNoInbound=${detachedIfNoInbound}`);
      // Загружаем актуальные inbounds для матчинга по remark (т.к. slug панелей и id могут отличаться)
      let live: InboundsResp | null = null;
      const { data: liveData, error: liveError } = await supabase.functions.invoke("panel?action=inbounds", { method: "GET" });
      if (liveError) {
        log(`WARN: не удалось свежо загрузить inbound'ы: ${liveError.message ?? liveError}`);
        live = inbounds;
      } else {
        live = liveData;
        setInbounds(liveData);
      }
      const responsePanelKeys = Object.keys(live ?? {}).filter((k) => k !== "_panels" && Array.isArray((live as any)[k]) && k && k !== "null" && k !== "undefined");
      const livePanels = (((live?._panels as PanelMeta[]) ?? [])
        .filter((p: any) => p?.slug && p.slug !== "null" && p.slug !== "undefined"));
      if (!livePanels.length && responsePanelKeys.length) livePanels.push(...responsePanelKeys.map((slug) => ({ slug, name: slug })));
      log(`Панели (${livePanels.length}): ${livePanels.map(p=>p.slug).join(", ")}`);
      // Нормализация remark: убираем эмодзи, флаги, пунктуацию, пробелы
      const norm = (s: string) =>
        (s || "")
          .toLowerCase()
          .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")
          .replace(/[^\p{L}\p{N}]+/gu, "")
          .trim();
      // Индекс: remark(lower) -> [{panel, inboundId}]
      const byRemark = new Map<string, { panel: string; inboundId: number }[]>();
      const byNorm = new Map<string, { panel: string; inboundId: number }[]>();
      const allLive: { panel: string; inboundId: number; remark: string; nrm: string }[] = [];
      const byPanelId = new Map<string, { panel: string; inboundId: number }>();
      for (const pm of livePanels) {
        const ibs = live?.[pm.slug];
        if (Array.isArray(ibs)) {
          for (const ib of ibs as InboundInfo[]) {
            byPanelId.set(`${pm.slug}:${ib.id}`, { panel: pm.slug, inboundId: ib.id });
            const key = (ib.remark || "").trim().toLowerCase();
            if (key) {
              const arr = byRemark.get(key) ?? [];
              arr.push({ panel: pm.slug, inboundId: ib.id });
              byRemark.set(key, arr);
            }
            const nk = norm(ib.remark || "");
            if (nk) {
              const arr = byNorm.get(nk) ?? [];
              arr.push({ panel: pm.slug, inboundId: ib.id });
              byNorm.set(nk, arr);
              allLive.push({ panel: pm.slug, inboundId: ib.id, remark: ib.remark || "", nrm: nk });
            }
          }
        }
      }
      log(`Live inbound'ов всего: ${allLive.length}`);
      for (const l of allLive) log(`  - panel=${l.panel} id=${l.inboundId} remark="${l.remark}" norm="${l.nrm}"`);
      let ok = 0;
      const errors: string[] = [];
      for (const item of list) {
        try {
          const name = String(item.name || "").trim();
          log(`\n--- Подписка "${name}" ---`);
          if (!name) { errors.push("пустое имя"); continue; }
          const rawSelections: any[] = item.inbounds ?? [];
          log(`  исходные inbound'ы (${rawSelections.length}): ${JSON.stringify(rawSelections)}`);
          const selections: { panel: string; inboundId: number }[] = [];
          const missing: string[] = [];
          const seen = new Set<string>();
          for (const x of rawSelections) {
            if (!x) continue;
            // 1) точное совпадение по panel:inbound_id
            const exactKey = `${x.panel}:${x.inbound_id}`;
            const exact = byPanelId.get(exactKey);
            if (exact) {
              const k = `${exact.panel}:${exact.inboundId}`;
              log(`    [exact] "${x.remark}" -> ${k}`);
              if (!seen.has(k)) { seen.add(k); selections.push(exact); }
              continue;
            }
            // 2) матчинг по remark
            const rk = String(x.remark || "").trim().toLowerCase();
            const matches = rk ? byRemark.get(rk) : undefined;
            if (matches && matches.length) {
              log(`    [remark] "${x.remark}" -> ${matches.map(m=>`${m.panel}:${m.inboundId}`).join(",")}`);
              for (const m of matches) {
                const k = `${m.panel}:${m.inboundId}`;
                if (!seen.has(k)) { seen.add(k); selections.push(m); }
              }
              continue;
            }
            // 3) матчинг по нормализованному remark (без эмодзи/пунктуации)
            const nk = norm(String(x.remark || ""));
            let fuzzy = nk ? byNorm.get(nk) : undefined;
            // 4) substring: ищем live remark, содержащий искомый или наоборот
            if ((!fuzzy || !fuzzy.length) && nk) {
              fuzzy = allLive
                .filter((l) => l.nrm === nk || l.nrm.includes(nk) || nk.includes(l.nrm))
                .map((l) => ({ panel: l.panel, inboundId: l.inboundId }));
            }
            if (fuzzy && fuzzy.length) {
              log(`    [fuzzy nk="${nk}"] "${x.remark}" -> ${fuzzy.map(m=>`${m.panel}:${m.inboundId}`).join(",")}`);
              for (const m of fuzzy) {
                const k = `${m.panel}:${m.inboundId}`;
                if (!seen.has(k)) { seen.add(k); selections.push(m); }
              }
            } else {
              log(`    [MISS nk="${nk}"] "${x.remark}" не найден`);
              missing.push(x.remark || `${x.panel}#${x.inbound_id}`);
            }
          }
          if (!selections.length) {
            if (fallbackAll) {
              const all = Array.from(byPanelId.values());
              if (all.length) {
                for (const m of all) selections.push(m);
                log(`  fallback: использованы все ${all.length} inbound'ов`);
                errors.push(`${name}: использованы все доступные inbound'ы (исходные: ${missing.join(", ")})`);
              }
            }
          }
          const expiryMs = Number(item.expiry_ms || 0);
          const days = expiryMs > 0 ? Math.max(1, Math.ceil((expiryMs - Date.now()) / 86400000)) : 0;
          const totalGB = item.total_bytes ? Math.round(Number(item.total_bytes) / 1024 / 1024 / 1024) : 0;
          if (!selections.length) {
            if (!detachedIfNoInbound) {
              log(`  SKIP: нет inbound'ов`);
              errors.push(`${name}: не нашёл inbound'ы (${missing.join(", ") || "пусто"})`);
              continue;
            }
            const desiredSlug = String(item.slug ?? "").trim();
            log(`  -> createDetached: days=${days} GB=${totalGB} slug=${desiredSlug || "(auto)"}`);
            const { data, error } = await supabase.functions.invoke("panel?action=createDetached", {
              method: "POST",
              body: { name, days, totalGB, slug: desiredSlug || undefined },
            });
            if (error) { log(`  ERROR detached invoke: ${error.message ?? error}`); throw error; }
            if (data?.error) { log(`  ERROR detached data: ${data.error}`); throw new Error(data.error); }
            log(`  OK detached: ${JSON.stringify(data).slice(0,300)}`);
            ok++;
            errors.push(`${name}: создана без inbound'ов — добавьте панели вручную`);
            continue;
          }
          const validSelections = selections.filter((s) => s.panel && s.panel !== "null" && s.panel !== "undefined" && Number.isFinite(s.inboundId));
          if (validSelections.length !== selections.length) log(`  FIX: удалены некорректные selections=${selections.map(s=>`${s.panel}:${s.inboundId}`).join(",")}`);
          if (!validSelections.length) throw new Error("панели загрузились без slug — обновите список inbound'ов и повторите импорт");
          const desiredSlug2 = String(item.slug ?? "").trim();
          log(`  -> create: days=${days} GB=${totalGB} slug=${desiredSlug2 || "(auto)"} selections=${validSelections.map(s=>`${s.panel}:${s.inboundId}`).join(",")}`);
          const { data, error } = await supabase.functions.invoke("panel?action=create", {
            method: "POST",
            body: { name, days, totalGB, selections: validSelections, slug: desiredSlug2 || undefined },
          });
          if (error) {
            log(`  ERROR invoke: ${error.message ?? error}`);
            log(`  ERROR detail: ${JSON.stringify(error)}`);
            throw error;
          }
          if (data?.error) {
            log(`  ERROR data: ${data.error}`);
            log(`  data: ${JSON.stringify(data).slice(0,500)}`);
            throw new Error(data.error);
          }
          log(`  OK: ${JSON.stringify(data).slice(0,300)}`);
          ok++;
          if (missing.length) errors.push(`${name}: пропущены inbound'ы (${missing.join(", ")})`);
        } catch (e: any) {
          log(`  EXCEPTION: ${e?.message ?? e}`);
          errors.push(`${item?.name ?? "?"}: ${e?.message ?? e}`);
        }
      }
      log(`\n=== Итог: ok=${ok}, ошибок/предупреждений=${errors.length} ===`);
      for (const e of errors) log(`  ! ${e}`);
      if (errors.length) {
        toast.warning(`Импорт: ${ok} успешно, ${errors.length} с предупреждениями`, {
          description: errors.slice(0, 8).join("\n"),
        });
      } else {
        toast.success(`Импортировано: ${ok}`);
      }
      loadSubs();
    } catch (e: any) {
      log(`FATAL: ${e?.message ?? e}`);
      toast.error("Ошибка импорта: " + (e?.message ?? e));
    } finally {
      setImportLog(L);
      setImportLogOpen(true);
      setImporting(false);
    }
  };

  const applyPreset = (p: { days: number; gb: number }) => {
    setDays(p.days);
    setTotalGB(p.gb);
  };

  const expiryStatus = (s: Subscription) => {
    if (!s.expiry_ms) return { label: "∞", tone: "muted" as const };
    const left = s.expiry_ms - Date.now();
    const days = Math.ceil(left / 86400000);
    if (left < 0) return { label: "истекла", tone: "danger" as const };
    if (days <= 3) return { label: `${days} дн.`, tone: "warn" as const };
    return { label: `${days} дн.`, tone: "muted" as const };
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container py-4 flex items-center gap-3">
          <div
            className="size-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--gradient-hero)" }}
          >
            <Zap className="size-4 text-primary-foreground" />
          </div>
          <span className="font-semibold">3X-UI Sub Manager</span>
        </div>
      </header>

      <main className="container py-8">
        <Tabs value={activeTab} className="space-y-6" onValueChange={(v) => {
          setActiveTab(v);
          if (v === "create") { loadInbounds(); loadEmailMap(); }
          if (v === "logs") loadServerLogs();
        }}>
          <TabsList className="grid w-full max-w-5xl grid-cols-8">
            <TabsTrigger value="stats">📊 Статистика</TabsTrigger>
            <TabsTrigger value="online">🟢 Онлайн</TabsTrigger>
            <TabsTrigger value="create">➕ Новый</TabsTrigger>
            <TabsTrigger value="subs">🔑 Подписки</TabsTrigger>
            <TabsTrigger value="servers">🖥️ Панели</TabsTrigger>
            <TabsTrigger value="external">🌐 Сторонние</TabsTrigger>
            <TabsTrigger value="update">🔄 Обновление</TabsTrigger>
            <TabsTrigger value="logs" onClick={() => { const t = Date.now(); setLastSeenLogTs(t); localStorage.setItem("logs_last_seen", String(t)); }}>
              🪵 Логи{(() => {
                const unread = appLogs.filter((l) => l.level === "error" && l.ts > lastSeenLogTs).length;
                return unread ? ` (${unread})` : "";
              })()}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="mt-0">
            <StatsDashboard />
          </TabsContent>

          <TabsContent value="online" className="mt-0">
            <OnlineClients />
          </TabsContent>

          <TabsContent value="create" className="mt-0">
        <Card className="p-6 border-border" style={{ background: "var(--gradient-card)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Plus className="size-4 text-primary" /> Новый клиент
            </h2>
            <Button variant="ghost" size="sm" onClick={loadInbounds} disabled={loadingInbounds}>
              <RefreshCw className={`size-4 mr-1 ${loadingInbounds ? "animate-spin" : ""}`} />
              Обновить
            </Button>
          </div>

          <div className="mb-4">
            <Label className="text-xs text-muted-foreground mb-2 block">Быстрые тарифы</Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const active = days === p.days && totalGB === p.gb;
                return (
                  <Button
                    key={p.label}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    onClick={() => applyPreset(p)}
                    style={active ? { background: "var(--gradient-hero)", color: "hsl(var(--primary-foreground))" } : undefined}
                  >
                    {p.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <div>
              <Label className="text-xs text-muted-foreground">Имя клиента</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иван" maxLength={64} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Принудительный URL</Label>
              <Input value={createSlug} onChange={(e) => setCreateSlug(e.target.value)} placeholder="например ivan2026" maxLength={32} />
              <p className="text-[10px] text-muted-foreground mt-1 break-all">{`${getSubBase()}/${createSlug.trim().toLowerCase().replace(/[^a-z0-9]/g, "") || "авто"}`}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Срок (дней, 0 = безлимит)</Label>
              <Input type="number" min={0} value={days} onChange={(e) => setDays(parseInt(e.target.value || "0", 10))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Трафик GB (0 = безлимит)</Label>
              <Input type="number" min={0} value={totalGB} onChange={(e) => setTotalGB(parseInt(e.target.value || "0", 10))} />
            </div>
          </div>

          <Label className="text-xs text-muted-foreground mb-2 block">Inbound'ы (на каких серверах создать)</Label>
          <div className="grid gap-3 md:grid-cols-2 mb-4">
            {panelMeta.map(({ slug: panel }) => {
              const list = inbounds?.[panel] as InboundInfo[] | { error: string } | undefined;
              return (
                <Card key={panel} className="p-4 bg-secondary/40 border-border">
                  <div className="flex items-center gap-2 mb-3 font-semibold">
                    <Server className="size-4 text-primary" />
                    {panelLabel(panel)}
                  </div>
                  {!inbounds && <div className="text-sm text-muted-foreground">Загрузка…</div>}
                  {Array.isArray(list) ? (
                    list.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Нет inbound'ов</div>
                    ) : (
                      <div className="space-y-2">
                        {list.map((ib) => {
                          const key = `${panel}:${ib.id}`;
                          const busy = bulkBusy === `add:${key}` || bulkBusy === `rm:${key}`;
                          return (
                            <div key={key}>
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                                <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm truncate">
                                    {inboundLabel(panel, ib.id, ib.remark)}
                                    {overrides[`${panel}:${ib.id}`] && (
                                      <span className="ml-2 text-[10px] uppercase text-muted-foreground" title={ib.remark}>↺ {ib.remark}</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {ib.protocol.toUpperCase()} · :{ib.port}
                                  </div>
                                </div>
                              </label>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="size-7 shrink-0" disabled={busy}>
                                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <MoreVertical className="size-3.5" />}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel className="text-xs">Действия</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => openRename(panel, ib.id, ib.remark || `#${ib.id}`)}>
                                    <Pencil className="size-3.5 mr-2 text-primary" /> Переименовать
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => bulkAdd(panel, ib.id, ib.remark || `#${ib.id}`)}>
                                    <UserPlus className="size-3.5 mr-2 text-green-500" /> Добавить всем
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => bulkRemove(panel, ib.id, ib.remark || `#${ib.id}`)} className="text-destructive focus:text-destructive">
                                    <UserMinus className="size-3.5 mr-2" /> Убрать у всех
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : list && "error" in list ? (
                    <div className="text-xs text-destructive">{list.error}</div>
                  ) : null}
                </Card>
              );
            })}
          </div>

          <Button
            onClick={create}
            disabled={creating}
            className="w-full font-semibold"
            style={{ background: "var(--gradient-hero)", color: "hsl(var(--primary-foreground))" }}
          >
            {creating ? <Loader2 className="size-4 animate-spin" /> : (
              <><Zap className="size-4 mr-1" /> Создать подписку</>
            )}
          </Button>
        </Card>
          </TabsContent>

          <TabsContent value="subs" className="mt-0">
        <section>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-semibold">Подписки ({subs.length})</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportSubs} disabled={subs.length === 0}>
                <Download className="size-3.5 mr-1" /> Экспорт
              </Button>
              <Button variant="outline" size="sm" disabled={importing} asChild>
                <label className="cursor-pointer">
                  {importing ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Upload className="size-3.5 mr-1" />}
                  Импорт
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) importSubs(f);
                    }}
                  />
                </label>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRawImportOpen(true)}>
                <Plus className="size-3.5 mr-1" /> Из текста
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!confirm("Сверить подписки с панелями 3X-UI и удалить те, чьих клиентов уже нет ни на одной панели?\n\nЭто необратимо.")) return;
                  try {
                    const { data, error } = await supabase.functions.invoke("panel?action=cleanupOrphans", { method: "POST", body: {} });
                    if (error) throw error;
                    const n = data?.deleted?.length ?? 0;
                    if (n === 0) toast.success("Осиротевших подписок не найдено");
                    else toast.success(`Удалено подписок: ${n}`);
                    if (data?.panelErrors && Object.keys(data.panelErrors).length) {
                      toast.warning("Часть панелей недоступна — см. консоль");
                      console.warn("cleanupOrphans panelErrors", data.panelErrors);
                    }
                    loadSubs();
                  } catch (e: any) {
                    toast.error("Ошибка: " + (e?.message ?? e));
                  }
                }}
              >
                <Trash2 className="size-3.5 mr-1" /> Очистить осиротевшие
              </Button>
            </div>
          </div>
          {subs.length > 0 && (
            <Card className="p-3 mb-3 border-border flex flex-wrap items-center gap-2" style={{ background: "var(--gradient-card)" }}>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={subsSearch}
                  onChange={(e) => setSubsSearch(e.target.value)}
                  placeholder="Поиск по имени, email или slug…"
                  className="pl-8 h-9"
                />
              </div>
              <Select value={subsSort} onValueChange={setSubsSort}>
                <SelectTrigger className="w-[200px] h-9">
                  <ArrowUpDown className="size-3.5 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_desc">Сначала новые</SelectItem>
                  <SelectItem value="created_asc">Сначала старые</SelectItem>
                  <SelectItem value="name_asc">Имя ↑ (A→Я)</SelectItem>
                  <SelectItem value="name_desc">Имя ↓ (Я→A)</SelectItem>
                  <SelectItem value="hits_desc">Больше hits</SelectItem>
                  <SelectItem value="hits_asc">Меньше hits</SelectItem>
                  <SelectItem value="expiry_asc">Скоро истекают</SelectItem>
                  <SelectItem value="expiry_desc">Позже истекают</SelectItem>
                  <SelectItem value="traffic_desc">Больше трафика</SelectItem>
                </SelectContent>
              </Select>
              {(() => {
                const visible = subs.filter((s) => {
                  const q = subsSearch.trim().toLowerCase();
                  if (!q) return true;
                  return s.name.toLowerCase().includes(q) || s.client_email.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q);
                });
                const allSelected = visible.length > 0 && visible.every((s) => subsSelected.has(s.id));
                return (
                  <label className="flex items-center gap-2 text-sm cursor-pointer px-2">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(v) => {
                        const next = new Set(subsSelected);
                        if (v) visible.forEach((s) => next.add(s.id));
                        else visible.forEach((s) => next.delete(s.id));
                        setSubsSelected(next);
                      }}
                    />
                    Выбрать все ({visible.length})
                  </label>
                );
              })()}
              {subsSelected.size > 0 && (
                <>
                  <span className="text-xs text-muted-foreground">Выбрано: {subsSelected.size}</span>
                  <Button variant="outline" size="sm" onClick={() => setSubsSelected(new Set())}>
                    Сбросить
                  </Button>
                  <Button variant="destructive" size="sm" onClick={bulkDeleteSubs} disabled={bulkDeleting}>
                    {bulkDeleting ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Trash2 className="size-3.5 mr-1" />}
                    Удалить выбранные
                  </Button>
                </>
              )}
            </Card>
          )}
          {subs.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground border-dashed">
              Подписок пока нет.
            </Card>
          ) : (
            <div className="grid gap-3">
              {(() => {
                const q = subsSearch.trim().toLowerCase();
                const filtered = subs.filter((s) =>
                  !q || s.name.toLowerCase().includes(q) || s.client_email.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q)
                );
                const sorted = [...filtered].sort((a, b) => {
                  switch (subsSort) {
                    case "created_asc": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                    case "name_asc": return a.name.localeCompare(b.name, "ru");
                    case "name_desc": return b.name.localeCompare(a.name, "ru");
                    case "hits_desc": return b.hits - a.hits;
                    case "hits_asc": return a.hits - b.hits;
                    case "expiry_asc": return (a.expiry_ms || Infinity) - (b.expiry_ms || Infinity);
                    case "expiry_desc": return (b.expiry_ms || 0) - (a.expiry_ms || 0);
                    case "traffic_desc": return b.total_bytes - a.total_bytes;
                    default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                  }
                });
                if (sorted.length === 0) {
                  return <Card className="p-6 text-center text-muted-foreground border-dashed">Ничего не найдено</Card>;
                }
                return sorted.map((s) => {
                const url = subUrl(s.slug);
                const happ = happUrl(s.slug);
                const status = expiryStatus(s);
                return (
                  <Card key={s.id} id={`sub-${s.id}`} className="p-4 border-border" style={{ background: "var(--gradient-card)" }}>
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <Checkbox
                        className="self-start md:self-center mt-1 md:mt-0"
                        checked={subsSelected.has(s.id)}
                        onCheckedChange={(v) => {
                          const next = new Set(subsSelected);
                          if (v) next.add(s.id); else next.delete(s.id);
                          setSubsSelected(next);
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold truncate">{s.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                            {s.hits} hits
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              status.tone === "danger"
                                ? "bg-destructive/20 text-destructive"
                                : status.tone === "warn"
                                ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {status.tone === "muted" && s.expiry_ms ? `до ${fmtExpire(s.expiry_ms)}` : status.label}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                            {fmtGB(s.total_bytes)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Link2 className="size-3 shrink-0" />
                          <code className="truncate">{url}</code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            title="Изменить URL подписки"
                            onClick={async () => {
                              if (editingId !== s.id) await openEdit(s);
                              setTimeout(() => {
                                const el = document.querySelector(`#sub-${s.id} input[data-slug-input="1"]`) as HTMLInputElement | null;
                                if (el) { el.focus(); el.select(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
                              }, 50);
                            }}
                          >
                            <Pencil className="size-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button variant="secondary" size="sm" onClick={() => copy(url)}>
                          <Copy className="size-3.5 mr-1" /> URL
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setActiveQr(activeQr === s.id ? null : s.id)}>
                          QR
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => editingId === s.id ? closeEdit() : openEdit(s)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => remove(s.id)}>
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {activeQr === s.id && (
                      <div className="mt-4 flex flex-col items-center gap-2 p-4 rounded-lg bg-secondary">
                        <div className="bg-white p-3 rounded">
                          <QRCodeSVG value={happ} size={180} />
                        </div>
                        <p className="text-xs text-muted-foreground break-all text-center max-w-xs">{happ}</p>
                      </div>
                    )}
                    {editingId === s.id && (
                      <div className="mt-4 p-4 rounded-lg bg-secondary space-y-4">
                        <div className="grid gap-3 md:grid-cols-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Имя</Label>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={64} />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Продлить (дней, 0 = безлимит)</Label>
                            <Input type="number" min={0} placeholder="не менять" value={editDays} onChange={(e) => setEditDays(e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Трафик GB (0 = безлимит)</Label>
                            <Input type="number" min={0} placeholder="не менять" value={editGB} onChange={(e) => setEditGB(e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">URL подписки (slug, a-z 0-9)</Label>
                          <Input data-slug-input="1" value={editSlug} onChange={(e) => setEditSlug(e.target.value)} maxLength={32} placeholder="например 8ic8nngcvdz7" />
                          <p className="text-[10px] text-muted-foreground mt-1 break-all">{`${getSubBase()}/${editSlug || s.slug}`}</p>
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground mb-2 block">Подключения</Label>
                          <div className="grid gap-3 md:grid-cols-2">
                            {panelMeta.map(({ slug: panel }) => {
                              const list = inbounds?.[panel] as InboundInfo[] | { error: string } | undefined;
                              return (
                                <Card key={panel} className="p-3 bg-background border-border">
                                  <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                                    <Server className="size-3.5 text-primary" />
                                    {panelLabel(panel)}
                                  </div>
                                  {Array.isArray(list) && list.length > 0 ? (
                                    <div className="space-y-2">
                                       {list.map((ib) => {
                                         const key = `${panel}:${ib.id}`;
                                         const wasExisting = editExisting.has(key);
                                         return (
                                          <label key={key} className="flex items-center gap-2 cursor-pointer">
                                            <Checkbox checked={editSelected.has(key)} onCheckedChange={() => toggleEdit(key)} />
                                            <div className="flex-1 min-w-0">
                                              <div className="text-sm truncate">
                                                {inboundLabel(panel, ib.id, ib.remark)}
                                              </div>
                                              <div className="text-xs text-muted-foreground">
                                                {ib.protocol.toUpperCase()} · :{ib.port}
                                              </div>
                                            </div>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-muted-foreground">Нет inbound'ов</div>
                                  )}
                                </Card>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                            <Eye className="size-3.5" /> Как увидит клиент в приложении (порядок ↕)
                          </Label>
                          <Card className="p-3 bg-background border-border">
                            {(() => {
                              const visible = editOrder.filter((k) => editSelected.has(k));
                              if (!visible.length) {
                                return <div className="text-xs text-muted-foreground">Нет выбранных подключений</div>;
                              }
                              const findIb = (key: string) => {
                                if (key.startsWith("ext:")) {
                                  const extId = key.slice(4);
                                  const e = editExternals[extId];
                                  return {
                                    panel: "ext",
                                    id: 0,
                                    remark: e ? `${e.emoji} ${e.name} · ${e.raw_links.length} серв.` : "Сторонняя подписка",
                                    isExt: true,
                                  };
                                }
                                const [panel, idStr] = key.split(":");
                                const list = inbounds?.[panel] as InboundInfo[] | { error: string } | undefined;
                                if (!Array.isArray(list)) return { panel, id: Number(idStr), remark: `#${idStr}`, isExt: false };
                                const ib = list.find((x) => x.id === Number(idStr));
                                return { panel, id: Number(idStr), remark: ib?.remark ?? `#${idStr}`, isExt: false };
                              };
                              return (
                                <div className="space-y-1">
                                  {visible.map((key, idx) => {
                                    const { panel, id, remark, isExt } = findIb(key);
                                    return (
                                      <div key={key} className="flex items-center gap-2 px-2 py-1.5 rounded bg-secondary/40">
                                        <span className="text-xs text-muted-foreground w-5 text-right tabular-nums">{idx + 1}.</span>
                                        <div className="flex-1 min-w-0 text-sm truncate">
                                          {isExt ? remark : inboundLabel(panel, id, remark)}
                                        </div>
                                        <Button variant="ghost" size="icon" className="size-7" disabled={idx === 0}
                                          onClick={() => moveOrder(key, -1)}>
                                          <ArrowUp className="size-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="size-7" disabled={idx === visible.length - 1}
                                          onClick={() => moveOrder(key, 1)}>
                                          <ArrowDown className="size-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive"
                                          title="Удалить inbound (применится при Сохранить)"
                                          onClick={() => toggleEdit(key)}>
                                          <Trash2 className="size-3.5" />
                                        </Button>
                                      </div>
                                    );
                                  })}
                                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                                    {(() => {
                                      const totalAvail = panelMeta.reduce((sum, { slug: panel }) => {
                                        const list = inbounds?.[panel] as InboundInfo[] | { error: string } | undefined;
                                        return sum + (Array.isArray(list) ? list.filter((ib) => !editSelected.has(`${panel}:${ib.id}`)).length : 0);
                                      }, 0);
                                      return (
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-8 text-xs">
                                              <Plus className="size-3.5 mr-1" />
                                              Добавить inbound {totalAvail > 0 ? `(${totalAvail})` : ""}
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-[420px] max-h-[60vh] overflow-y-auto p-3" align="start">
                                            <div className="text-xs text-muted-foreground mb-2">Отметьте, какие inbound'ы должны быть у клиента. Применится при «Сохранить».</div>
                                            <div className="space-y-3">
                                              {panelMeta.map(({ slug: panel }) => {
                                                const list = inbounds?.[panel] as InboundInfo[] | { error: string } | undefined;
                                                return (
                                                  <div key={panel}>
                                                    <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold">
                                                      <Server className="size-3 text-primary" />
                                                      {panelLabel(panel)}
                                                      {!Array.isArray(list) && (
                                                        <span className="text-destructive font-normal">
                                                          {list && "error" in list ? `· ${list.error}` : "· загрузка..."}
                                                        </span>
                                                      )}
                                                    </div>
                                                    {Array.isArray(list) && list.length > 0 ? (
                                                      <div className="space-y-1 pl-1">
                                                        {list.map((ib) => {
                                                          const k = `${panel}:${ib.id}`;
                                                          const checked = editSelected.has(k);
                                                          return (
                                                            <label key={k} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-secondary/40 rounded px-1.5 py-1">
                                                              <Checkbox checked={checked} onCheckedChange={() => toggleEdit(k)} />
                                                              <span className="flex-1 truncate">{inboundLabel(panel, ib.id, ib.remark)}</span>
                                                              <span className="text-[10px] text-muted-foreground uppercase">{ib.protocol}:{ib.port}</span>
                                                            </label>
                                                          );
                                                        })}
                                                      </div>
                                                    ) : Array.isArray(list) ? (
                                                      <div className="text-xs text-muted-foreground pl-1">Нет inbound'ов</div>
                                                    ) : null}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      );
                                    })()}
                                    <Button variant="outline" size="sm" onClick={() => saveOrder(s)}>
                                      <Check className="size-3.5 mr-1" /> Сохранить порядок
                                    </Button>
                                  </div>
                                </div>
                              );
                            })()}
                          </Card>
                        </div>

                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="sm" onClick={closeEdit} disabled={savingEdit}>
                            <X className="size-4 mr-1" /> Отмена
                          </Button>
                          <Button size="sm" onClick={() => saveEdit(s)} disabled={savingEdit}
                            style={{ background: "var(--gradient-hero)", color: "hsl(var(--primary-foreground))" }}>
                            {savingEdit ? <Loader2 className="size-4 animate-spin" /> : (<><Check className="size-4 mr-1" />Сохранить</>)}
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              });
              })()}
            </div>
          )}
        </section>
          </TabsContent>

          <TabsContent value="servers" className="mt-0">
            <PanelsManager onChanged={loadInbounds} />
          </TabsContent>

          <TabsContent value="external" className="mt-0">
            <ExternalSubsPanel />
          </TabsContent>

          <TabsContent value="update" className="mt-0">
            <UpdatePanel />
          </TabsContent>

          <TabsContent value="logs" className="mt-0">
            <Card className="p-4 border-border" style={{ background: "var(--gradient-card)" }}>
              {(() => {
                // Merge client + server into one stream
                const clientItems = appLogs.map((l) => ({
                  ts: l.ts, level: l.level, source: `client:${l.source}`,
                  message: l.message, request_id: null as string | null, action: l.source,
                }));
                const serverItems = serverLogs.map((s) => ({
                  ts: new Date(s.ts).getTime(),
                  level: (s.level as any) || "info",
                  source: `server:${s.action}${s.panel_slug ? `@${s.panel_slug}` : ""}`,
                  message: [s.error, s.duration_ms != null ? `(${s.duration_ms}ms)` : "", s.meta && Object.keys(s.meta).length ? JSON.stringify(s.meta) : ""].filter(Boolean).join(" "),
                  request_id: s.request_id, action: s.action,
                }));
                const merged = [
                  ...(logSource === "server" ? [] : clientItems),
                  ...(logSource === "client" ? [] : serverItems),
                ]
                  .filter((l) => logLevel === "all" || l.level === logLevel)
                  .filter((l) => !logSearch.trim() || (l.message + " " + l.source).toLowerCase().includes(logSearch.toLowerCase().trim()))
                  .sort((a, b) => b.ts - a.ts);

                // Group identical messages
                const grouped: { key: string; first: typeof merged[0]; count: number; ts: number }[] = [];
                if (logGroup) {
                  const map = new Map<string, { first: typeof merged[0]; count: number; ts: number }>();
                  for (const m of merged) {
                    const key = `${m.level}|${m.source}|${m.message.slice(0, 200)}`;
                    const ex = map.get(key);
                    if (ex) { ex.count++; if (m.ts > ex.ts) ex.ts = m.ts; }
                    else map.set(key, { first: m, count: 1, ts: m.ts });
                  }
                  for (const [k, v] of map) grouped.push({ key: k, ...v });
                  grouped.sort((a, b) => b.ts - a.ts);
                }

                const display = logGroup ? grouped : merged.map((m, i) => ({ key: String(i), first: m, count: 1, ts: m.ts }));
                const exportText = merged.map((l) => `[${new Date(l.ts).toISOString()}] ${l.level.toUpperCase()} ${l.source}${l.request_id ? ` rid=${l.request_id.slice(0,8)}` : ""}: ${l.message}`).join("\n");

                return (
                  <>
                    <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <FileText className="size-4 text-primary" /> Логи ({display.length}{logGroup ? ` групп / ${merged.length}` : ""})
                      </h2>
                      <div className="flex gap-2 flex-wrap">
                        <Button variant="outline" size="sm" onClick={loadServerLogs} disabled={serverLogsLoading}>
                          {serverLogsLoading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <RefreshCw className="size-3.5 mr-1" />} Серверные
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(exportText || "(пусто)"); toast.success("Логи скопированы"); }}>
                          <Copy className="size-3.5 mr-1" /> Скопировать
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          const blob = new Blob([JSON.stringify(merged, null, 2)], { type: "application/json" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url; a.download = `app-logs-${new Date().toISOString().slice(0,19)}.json`;
                          document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
                        }}>
                          <Download className="size-3.5 mr-1" /> JSON
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { APP_LOGS.length = 0; localStorage.removeItem(LS_KEY); setAppLogs([]); setServerLogs([]); }}>
                          <Trash className="size-3.5 mr-1" /> Очистить
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-2 md:grid-cols-5 mb-3">
                      <select className="bg-background border border-border rounded px-2 py-1 text-xs" value={logSource} onChange={(e) => setLogSource(e.target.value as any)}>
                        <option value="all">Все источники</option>
                        <option value="client">Только клиент</option>
                        <option value="server">Только сервер</option>
                      </select>
                      <select className="bg-background border border-border rounded px-2 py-1 text-xs" value={logLevel} onChange={(e) => setLogLevel(e.target.value as any)}>
                        <option value="all">Все уровни</option>
                        <option value="error">Errors</option>
                        <option value="warn">Warnings</option>
                        <option value="info">Info</option>
                      </select>
                      <select className="bg-background border border-border rounded px-2 py-1 text-xs" value={logHours} onChange={(e) => setLogHours(Number(e.target.value))}>
                        <option value={1}>1 час</option>
                        <option value={24}>24 часа</option>
                        <option value={168}>7 дней</option>
                        <option value={720}>30 дней</option>
                      </select>
                      <Input placeholder="🔍 поиск..." value={logSearch} onChange={(e) => setLogSearch(e.target.value)} className="text-xs h-8" />
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input type="checkbox" checked={logGroup} onChange={(e) => setLogGroup(e.target.checked)} />
                        Группировать одинаковые
                      </label>
                    </div>
                    {display.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-8 text-center">Записей нет. Нажмите «Серверные» чтобы загрузить из БД.</div>
                    ) : (
                      <div className="space-y-1 max-h-[65vh] overflow-auto font-mono text-xs">
                        {display.map((g) => {
                          const l = g.first;
                          return (
                            <div key={g.key} className={`px-2 py-1 rounded ${l.level === "error" ? "bg-destructive/10 text-destructive" : l.level === "warn" ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" : "bg-secondary/40 text-muted-foreground"}`}>
                              <span className="opacity-60">{new Date(g.ts).toLocaleTimeString()}</span>
                              <span className="ml-2 uppercase opacity-70">{l.level}</span>
                              <span className="ml-2 opacity-70">{l.source}</span>
                              {g.count > 1 && <span className="ml-2 px-1.5 py-0.5 rounded bg-foreground/10 text-foreground/80">×{g.count}</span>}
                              {l.request_id && <span className="ml-2 opacity-50">rid:{l.request_id.slice(0, 8)}</span>}
                              <pre className="whitespace-pre-wrap break-all mt-0.5">{l.message}</pre>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Переименовать подключение</DialogTitle>
            <DialogDescription>Задайте флаг страны и название, которое увидят клиенты.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Это название увидят клиенты в приложении (Happ и др.). Имя панели — только для навигации внутри админки.
              Оригинальное имя на панели: <code>{renameTarget?.original}</code>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Флаг страны (только иконка)</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start">
                    {renameCountry
                      ? `${countryByCode(renameCountry)?.flag} ${countryByCode(renameCountry)?.name}`
                      : "🏳️ Без страны"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto w-72">
                  <DropdownMenuItem onClick={() => setRenameCountry("")}>
                    <span className="text-lg mr-2">🏳️</span><span>Без страны</span>
                  </DropdownMenuItem>
                  {COUNTRIES.map((c) => (
                    <DropdownMenuItem key={c.code} onClick={() => setRenameCountry(c.code)}>
                      <span className="text-lg mr-2">{c.flag}</span>
                      <span>{c.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{c.code}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Подпись (что показать клиенту)</Label>
              <Input
                value={renameLabel}
                onChange={(e) => setRenameLabel(e.target.value)}
                placeholder="YouTube без рекламы"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") saveRename(); }}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Превью: <code>{buildDisplay(renameCountry, renameLabel) || "— пусто —"}</code>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Оставь оба поля пустыми, чтобы сбросить переименование.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)} disabled={renameSaving}>Отмена</Button>
            <Button onClick={saveRename} disabled={renameSaving}
              style={{ background: "var(--gradient-hero)", color: "hsl(var(--primary-foreground))" }}>
              {renameSaving ? <Loader2 className="size-4 animate-spin" /> : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rawImportOpen} onOpenChange={setRawImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Создать подписку из текста</DialogTitle>
            <DialogDescription>Вставьте готовые ссылки или base64-код подписки.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Имя подписки</Label>
              <Input value={rawImportName} onChange={(e) => setRawImportName(e.target.value)} placeholder="Olga" maxLength={64} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Новый домен</Label>
              <Input value={rawImportDomain} onChange={(e) => setRawImportDomain(e.target.value)} placeholder="vpn.example.com или https://vpn.example.com" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Код/текст подписки из панели</Label>
              <Textarea
                value={rawImportText}
                onChange={(e) => setRawImportText(e.target.value)}
                className="min-h-48 font-mono text-xs"
                placeholder="Вставь base64-код подписки или строки vless://..."
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Клиенты в новой подписке не создаются на panel — будут отдаваться готовые ссылки, а host в них заменится на новый домен.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRawImportOpen(false)} disabled={rawImporting}>Отмена</Button>
            <Button onClick={importRawSubscription} disabled={rawImporting || !rawImportText.trim()}
              style={{ background: "var(--gradient-hero)", color: "hsl(var(--primary-foreground))" }}>
              {rawImporting ? <Loader2 className="size-4 animate-spin" /> : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importLogOpen} onOpenChange={setImportLogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Лог импорта подписок</DialogTitle>
            <DialogDescription>Подробный отчёт по последнему импорту.</DialogDescription>
          </DialogHeader>
          <Textarea
            readOnly
            value={importLog.join("\n")}
            className="min-h-[60vh] font-mono text-xs"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              navigator.clipboard.writeText(importLog.join("\n"));
              toast.success("Лог скопирован");
            }}>
              <Copy className="size-4 mr-1" /> Скопировать
            </Button>
            <Button variant="outline" onClick={() => {
              const blob = new Blob([importLog.join("\n")], { type: "text/plain" });
              const u = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = u; a.download = `import-log-${Date.now()}.txt`;
              document.body.appendChild(a); a.click(); a.remove();
              URL.revokeObjectURL(u);
            }}>
              <Download className="size-4 mr-1" /> Скачать
            </Button>
            <Button onClick={() => setImportLogOpen(false)}>Закрыть</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
