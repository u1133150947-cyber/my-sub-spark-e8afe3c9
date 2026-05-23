import { useEffect, useState } from "react";
import { Zap, Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { StatsDashboard } from "@/components/StatsDashboard";
import { PanelsManager } from "@/components/PanelsManager";
import { OnlineClients } from "@/components/OnlineClients";
import { UpdatePanel } from "@/components/UpdatePanel";
import { LogsTab } from "@/modules/logs/LogsTab";
import { CreateTab } from "@/modules/subs/CreateTab";
import { SubsTab } from "@/modules/subs/SubsTab";
import { RenameDialog } from "@/modules/subs/RenameDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type {
  AppLog,
  Subscription,
  InboundInfo,
  PanelKey,
  PanelMeta,
  InboundsResp,
} from "@/modules/shared/types";
import {
  findCountryByPrefix,
  buildDisplay,
  DEFAULT_EXTERNAL_SORT,
  effectiveExternalSort,
} from "@/modules/shared/constants";
import {
  APP_LOGS,
  APP_LOG_LISTENERS,
  pushLog,
} from "@/modules/shared/utils";

const Index = () => {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [inbounds, setInbounds] = useState<InboundsResp | null>(null);
  const [loadingInbounds, setLoadingInbounds] = useState(false);
  const [name, setName] = useState("");
  const [days, setDays] = useState(30);
  const [totalGB, setTotalGB] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [activeQr, setActiveQr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDays, setEditDays] = useState<string>("");
  const [editGB, setEditGB] = useState<string>("");
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
  const [appLogs, setAppLogs] = useState<AppLog[]>(APP_LOGS.slice());
  useEffect(() => {
    const fn = () => setAppLogs(APP_LOGS.slice());
    APP_LOG_LISTENERS.add(fn);
    return () => { APP_LOG_LISTENERS.delete(fn); };
  }, []);

  // ===== Logs: только badge непрочитанных и тайминг последнего просмотра =====
  const [lastSeenLogTs, setLastSeenLogTs] = useState<number>(() => {
    try { return Number(localStorage.getItem("logs_last_seen") || "0"); } catch { return 0; }
  });

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

    const selections = Array.from(selected).map((s) => {
      const [panel, id] = s.split(":");
      return { panel: panel as PanelKey, inboundId: Number(id) };
    });

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("panel?action=create", {
        method: "POST",
        body: { name: name.trim(), days, totalGB, selections },
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
          <div className="ml-auto">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                  </span>
                  <Wifi className="size-4" />
                  <span className="hidden sm:inline">Онлайн</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Клиенты онлайн</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <OnlineClients />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <Tabs value={activeTab} className="space-y-6" onValueChange={(v) => {
          setActiveTab(v);
          if (v === "create") { loadInbounds(); loadEmailMap(); }
        }}>
          <TabsList className="grid w-full max-w-5xl grid-cols-6">
            <TabsTrigger value="stats">📊 Статистика</TabsTrigger>
            <TabsTrigger value="create">➕ Новый</TabsTrigger>
            <TabsTrigger value="subs">🔑 Подписки</TabsTrigger>
            <TabsTrigger value="servers">🖥️ Панели</TabsTrigger>
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

          <TabsContent value="create" className="mt-0">
            <CreateTab
              inbounds={inbounds}
              loadingInbounds={loadingInbounds}
              loadInbounds={loadInbounds}
              panelMeta={panelMeta}
              panelLabel={panelLabel}
              inboundLabel={inboundLabel}
              overrides={overrides}
              name={name}
              setName={setName}
              days={days}
              setDays={setDays}
              totalGB={totalGB}
              setTotalGB={setTotalGB}
              selected={selected}
              setSelected={setSelected}
              toggle={toggle}
              applyPreset={applyPreset}
              creating={creating}
              create={create}
              bulkBusy={bulkBusy}
              bulkAdd={bulkAdd}
              bulkRemove={bulkRemove}
              openRename={openRename}
            />
          </TabsContent>

          <TabsContent value="subs" className="mt-0">
        <section>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-semibold">Подписки ({subs.length})</h2>
            <div className="flex gap-2">
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
                          <Label className="text-xs text-muted-foreground mb-2 block">Подключения</Label>
                          <div className="grid gap-3 md:grid-cols-2">
                            {panelMeta.map(({ slug: panel }) => {
                              const list = inbounds?.[panel] as InboundInfo[] | { error: string } | undefined;
                              return (
                                <Card key={panel} className="p-3 bg-background border-border">
                                  <div className="flex items-center justify-between mb-2 text-sm font-semibold">
                                    <div className="flex items-center gap-2">
                                      <Server className="size-3.5 text-primary" />
                                      {panelLabel(panel)}
                                    </div>
                                    {Array.isArray(list) && list.length > 0 && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-5 px-2 text-[10px] text-muted-foreground"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          const next = new Set(editSelected);
                                          const allKeys = list.map(ib => `${panel}:${ib.id}`);
                                          const allSelected = allKeys.every(k => next.has(k));
                                          if (allSelected) {
                                            allKeys.forEach(k => next.delete(k));
                                          } else {
                                            allKeys.forEach(k => next.add(k));
                                            setEditOrder(prev => Array.from(new Set([...prev, ...allKeys])));
                                          }
                                          setEditSelected(next);
                                        }}
                                      >
                                        {list.map(ib => `${panel}:${ib.id}`).every(k => editSelected.has(k)) ? "Снять все" : "Выбрать все"}
                                      </Button>
                                    )}
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

          <TabsContent value="update" className="mt-0">
            <UpdatePanel />
          </TabsContent>

          <TabsContent value="logs" className="mt-0">
            <LogsTab appLogs={appLogs} setAppLogs={setAppLogs} active={activeTab === "logs"} />
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

    </div>
  );
};

export default Index;
