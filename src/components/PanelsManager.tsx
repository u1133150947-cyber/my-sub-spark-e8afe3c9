import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Plus, Server, Trash2, Wifi, WifiOff, CheckCircle2, AlertCircle, Pencil, Check, X, Download, Upload, Activity } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FLAG_MAP, FLAG_RE } from "@/lib/flags";

type Panel = {
  id: string;
  name: string;
  host?: string;
  public_host?: string;
  panel_url: string;
  username: string;
  password: string;
  status: string;
  status_message: string;
  last_checked_at: string | null;
  country: string;
  slug?: string;
};

const empty = { name: "", panel_url: "", username: "", password: "", country: "", public_host: "" };

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
const cleanHost = (value: string) => {
  const raw = value.trim();
  if (!raw) return "";
  try { return new URL(raw.includes("://") ? raw : `http://${raw}`).hostname; } catch {}
  return raw.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/^\[|\]$/g, "").replace(/:\d+$/, "");
};

const detectFlag = (name: string): string => {
  if (FLAG_RE.test(name)) return "";
  const lower = name.toLowerCase();
  for (const { keys, flag } of FLAG_MAP) {
    if (keys.some((k) => new RegExp(`\\b${k}`, "i").test(lower))) return flag;
  }
  return "";
};

const withFlag = (name: string) => {
  const f = detectFlag(name);
  return f ? `${f} ${name}` : name;
};

export const PanelsManager = ({ onChanged }: { onChanged?: () => void } = {}) => {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [credsPanel, setCredsPanel] = useState<Panel | null>(null);
  const [credsForm, setCredsForm] = useState({ panel_url: "", username: "", password: "", public_host: "" });
  const [credsSaving, setCredsSaving] = useState(false);
  const [credsTesting, setCredsTesting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [healthChecking, setHealthChecking] = useState(false);
  const [uptime, setUptime] = useState<Record<string, { uptime_pct: number; avg_latency_ms: number; checks: number }>>({});

  const loadHealthHistory = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("panel?action=healthHistory&hours=24", { method: "GET" });
      if (error) return;
      setUptime((data as any)?.uptime ?? {});
    } catch {}
  };

  const runHealthCheck = async () => {
    setHealthChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("panel?action=healthCheck", { method: "POST" });
      if (error) throw error;
      const checks = (data as any)?.checks ?? [];
      const ok = checks.filter((c: any) => c.status === "ok").length;
      toast.success(`Health-check: ${ok}/${checks.length} онлайн`);
      await load();
      await loadHealthHistory();
    } catch (e: any) {
      toast.error("Health-check failed: " + (e?.message ?? e));
    } finally {
      setHealthChecking(false);
    }
  };

  const load = async () => {
    const { data, error } = await supabase
      .from("panels")
        .select("id, name, host, public_host, panel_url, username, password, status, status_message, last_checked_at, country, slug")
      .order("created_at", { ascending: true });
    if (error) return toast.error("Не удалось загрузить панели");
    setPanels((data ?? []) as Panel[]);
  };

  const exportPanels = async () => {
    try {
      const { data, error } = await supabase
        .from("panels")
        .select("name, panel_url, username, password, country, template, readiness, public_host, ssh_user, ssh_port, ssh_auth_type, ssh_password, ssh_key_passphrase, slug")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const out = {
        version: 1,
        kind: "panels",
        exported_at: new Date().toISOString(),
        panels: data ?? [],
      };
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `panels-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Экспортировано: ${out.panels.length}`);
    } catch (e: any) {
      toast.error("Ошибка экспорта: " + (e?.message ?? e));
    }
  };

  const importPanels = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list: any[] = parsed?.panels ?? (Array.isArray(parsed) ? parsed : []);
      if (!list.length) throw new Error("Пустой файл импорта");
      if (!confirm(`Импортировать ${list.length} панелей? Существующие с тем же URL будут пропущены.`)) {
        setImporting(false);
        return;
      }
      const { data: existing } = await supabase.from("panels").select("panel_url");
      const existingUrls = new Set((existing ?? []).map((p: any) => (p.panel_url ?? "").trim()));
      let ok = 0, skipped = 0, errors = 0;
      for (const p of list) {
        const url = (p.panel_url ?? "").trim();
        if (!url || !p.name) { errors++; continue; }
        if (existingUrls.has(url)) { skipped++; continue; }
        const row: any = {
          name: p.name,
          panel_url: url,
          username: p.username ?? "",
          password: p.password ?? "",
          country: p.country ?? "",
        };
        if (p.template) row.template = p.template;
        if (p.readiness) row.readiness = p.readiness;
        if (p.public_host !== undefined) row.public_host = p.public_host;
        if (p.ssh_user) row.ssh_user = p.ssh_user;
        if (p.ssh_port) row.ssh_port = p.ssh_port;
        if (p.ssh_auth_type) row.ssh_auth_type = p.ssh_auth_type;
        if (p.ssh_password !== undefined) row.ssh_password = p.ssh_password;
        if (p.ssh_key_passphrase !== undefined) row.ssh_key_passphrase = p.ssh_key_passphrase;
        const { error } = await supabase.from("panels").insert(row);
        if (error) errors++; else ok++;
      }
      await load();
      onChanged?.();
      toast.success(`Импорт: ${ok} добавлено, ${skipped} пропущено${errors ? `, ${errors} ошибок` : ""}`);
    } catch (e: any) {
      toast.error("Ошибка импорта: " + (e?.message ?? e));
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    load();
    loadHealthHistory();
  }, []);

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const add = async () => {
    if (!form.name.trim() || !form.panel_url.trim() || !form.username.trim() || !form.password.trim()) {
      return toast.error("Заполните название, URL панели, логин и пароль");
    }
    setSaving(true);
    const host = cleanHost(form.panel_url);
    const publicHost = cleanHost(form.public_host) || host;
    const { error } = await supabase.from("panels").insert({
      name: form.name.trim(),
      panel_url: form.panel_url.trim(),
      username: form.username.trim(),
      password: form.password,
      country: form.country.trim().toUpperCase(),
      host,
      public_host: publicHost,
    });
    setSaving(false);
    if (error) return toast.error("Ошибка: " + error.message);
    toast.success("Панель добавлена");
    setForm({ ...empty });
    load();
    onChanged?.();
  };

  const remove = async (id: string) => {
    const panel = panels.find((x) => x.id === id);
    const { count } = await supabase
      .from("subscription_inbounds")
      .select("id", { count: "exact", head: true })
      .eq("panel", panel?.name ?? "");
    const msg = count && count > 0
      ? `Удалить панель «${panel?.name}»?\n\nОна используется в ${count} подписк(ах) — пропадёт у пользователей при следующем обновлении подписки.`
      : `Удалить панель «${panel?.name}»?`;
    if (!confirm(msg)) return;
    const { error } = await supabase.from("panels").delete().eq("id", id);
    if (error) return toast.error("Ошибка удаления");
    toast.success(count && count > 0 ? `Удалено. Очищено подписок: ${count}` : "Удалено");
    load();
    onChanged?.();
  };

  const startEdit = (p: Panel) => {
    setEditingId(p.id);
    setEditName(p.name);
  };

  const saveEdit = async (p: Panel) => {
    const newName = editName.trim();
    if (!newName || newName === p.name) {
      setEditingId(null);
      return;
    }
    const { error } = await supabase.from("panels").update({ name: newName }).eq("id", p.id);
    if (error) return toast.error("Ошибка: " + error.message);
    toast.success("Название обновлено — изменится во всех подписках");
    setEditingId(null);
    load();
    onChanged?.();
  };

  const setCountry = async (p: Panel, code: string) => {
    const { error } = await supabase.from("panels").update({ country: code.toUpperCase() }).eq("id", p.id);
    if (error) return toast.error("Ошибка: " + error.message);
    toast.success("Страна обновлена — применится при обновлении подписки");
    load();
    onChanged?.();
  };

  const openCreds = (p: Panel) => {
    setCredsPanel(p);
    setCredsForm({ panel_url: p.panel_url, username: p.username, password: p.password, public_host: p.public_host || p.host || cleanHost(p.panel_url) });
  };

  const testCreds = async () => {
    setCredsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("panel?action=testPanel", {
        method: "POST",
        body: credsForm,
      });
      if (error) throw error;
      data?.ok ? toast.success("Подключение работает") : toast.error(data?.error ?? "Не удалось подключиться");
    } catch (e: any) {
      toast.error("Ошибка проверки: " + (e?.message ?? e));
    } finally {
      setCredsTesting(false);
    }
  };

  const saveCreds = async () => {
    if (!credsPanel) return;
    if (!credsForm.panel_url.trim() || !credsForm.username.trim() || !credsForm.password) {
      return toast.error("Заполните URL, логин и пароль");
    }
    setCredsSaving(true);
    const host = cleanHost(credsForm.panel_url);
    const publicHost = cleanHost(credsForm.public_host) || host;
    const { error } = await supabase
      .from("panels")
      .update({
        panel_url: credsForm.panel_url.trim(),
        username: credsForm.username.trim(),
        password: credsForm.password,
        host,
        public_host: publicHost,
        status: "unknown",
        status_message: "",
      })
      .eq("id", credsPanel.id);
    setCredsSaving(false);
    if (error) return toast.error("Ошибка: " + error.message);
    toast.success("Доступы обновлены — slug сохранён, подписки продолжат работать");
    setCredsPanel(null);
    load();
    onChanged?.();
  };

  const testConnection = async (p: Panel) => {
    setTestingId(p.id);
    try {
      const { data, error } = await supabase.functions.invoke("panel?action=testPanel", {
        method: "POST",
        body: { panel_url: p.panel_url, username: p.username, password: p.password },
      });
      if (error) throw error;
      const ok = !!data?.ok;
      const msg = ok ? "" : data?.error ?? "Неизвестная ошибка";
      await supabase
        .from("panels")
        .update({
          status: ok ? "ok" : "error",
          status_message: msg,
          last_checked_at: new Date().toISOString(),
        })
        .eq("id", p.id);
      ok ? toast.success(`${p.name}: подключение работает`) : toast.error(`${p.name}: ${msg}`);
      load();
    } catch (e: any) {
      toast.error("Ошибка проверки: " + (e?.message ?? e));
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border-border" style={{ background: "var(--gradient-card)" }}>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <Plus className="size-4 text-primary" /> Добавить панель
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Подключаем существующую 3X-UI панель — укажи URL, логин и пароль, остальное подтянется автоматически.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label className="text-xs text-muted-foreground">Страна (определяет флаг и название для пользователей)</Label>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="shrink-0 px-3" title="Выбрать страну">
                    {form.country ? `${countryByCode(form.country)?.flag ?? "🏳️"} ${form.country}` : "🏳️ Страна"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto w-56">
                  {COUNTRIES.map((c) => (
                    <DropdownMenuItem key={c.code} onClick={() => update("country", c.code)}>
                      <span className="text-lg mr-2">{c.flag}</span>
                      <span>{c.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{c.code}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Внутреннее название (для админки)"
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Пользователю показывается «{form.country ? `${countryByCode(form.country)?.flag} ${countryByCode(form.country)?.name}` : "🏳️ Страна"}», а название — только для тебя в админке.
            </p>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs text-muted-foreground">URL панели</Label>
            <Input
              value={form.panel_url}
              onChange={(e) => update("panel_url", e.target.value)}
              placeholder="https://1.2.3.4:54321/secret-path"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Логин панели</Label>
            <Input value={form.username} onChange={(e) => update("username", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Пароль панели</Label>
            <Input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} />
          </div>
        </div>

        <Button
          onClick={add}
          disabled={saving}
          className="mt-4"
          style={{ background: "var(--gradient-hero)", color: "hsl(var(--primary-foreground))" }}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : (<><Plus className="size-4 mr-1" /> Добавить панель</>)}
        </Button>
      </Card>

      <section>
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h2 className="text-lg font-semibold">Панели ({panels.length})</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={runHealthCheck} disabled={healthChecking || panels.length === 0}>
              {healthChecking ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Activity className="size-3.5 mr-1" />}
              Health-check
            </Button>
            <Button variant="outline" size="sm" onClick={exportPanels} disabled={panels.length === 0}>
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
                    e.currentTarget.value = "";
                    if (f) importPanels(f);
                  }}
                />
              </label>
            </Button>
          </div>
        </div>
        {panels.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground border-dashed">Панелей пока нет.</Card>
        ) : (
          <div className="grid gap-3">
            {panels.map((p) => (
              <Card key={p.id} className="p-4 border-border" style={{ background: "var(--gradient-card)" }}>
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Server className="size-4 text-primary shrink-0" />
                      {editingId === p.id ? (
                        <>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(p);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            autoFocus
                            className="h-7 max-w-xs"
                          />
                          <Button size="sm" variant="ghost" onClick={() => saveEdit(p)} className="h-7 px-2">
                            <Check className="size-3.5 text-green-500" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 px-2">
                            <X className="size-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-base" title="Сменить страну">
                                {countryByCode(p.country)?.flag ?? "🏳️"}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto w-56">
                              {COUNTRIES.map((c) => (
                                <DropdownMenuItem key={c.code} onClick={() => setCountry(p, c.code)}>
                                  <span className="text-lg mr-2">{c.flag}</span>
                                  <span>{c.name}</span>
                                  <span className="ml-auto text-xs text-muted-foreground">{c.code}</span>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <span className="font-semibold truncate">{p.name}</span>
                          {p.country && countryByCode(p.country) && (
                            <span className="text-xs text-muted-foreground">→ {countryByCode(p.country)!.flag} {countryByCode(p.country)!.name}</span>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => startEdit(p)} className="h-6 px-1.5">
                            <Pencil className="size-3 text-muted-foreground" />
                          </Button>
                        </>
                      )}
                      {p.status === "ok" ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400 flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> онлайн
                        </span>
                      ) : p.status === "error" ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive flex items-center gap-1">
                          <AlertCircle className="size-3" /> ошибка
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                          не проверена
                        </span>
                      )}
                    </div>
                    <code className="text-xs text-muted-foreground truncate block">{p.panel_url || "URL не задан"}</code>
                    {p.status === "error" && p.status_message && (
                      <div className="text-xs text-destructive mt-1 truncate">{p.status_message}</div>
                    )}
                    {p.slug && uptime[p.slug] && (
                      <div className="text-xs text-muted-foreground mt-1">
                        24ч uptime: <span className={uptime[p.slug].uptime_pct >= 99 ? "text-green-500" : uptime[p.slug].uptime_pct >= 90 ? "text-yellow-500" : "text-destructive"}>{uptime[p.slug].uptime_pct}%</span>
                        {" · "}avg {uptime[p.slug].avg_latency_ms}ms · {uptime[p.slug].checks} проверок
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testConnection(p)}
                      disabled={testingId === p.id || !p.panel_url}
                    >
                      {testingId === p.id ? (
                        <Loader2 className="size-3.5 mr-1 animate-spin" />
                      ) : p.status === "ok" ? (
                        <Wifi className="size-3.5 mr-1" />
                      ) : (
                        <WifiOff className="size-3.5 mr-1" />
                      )}
                      Проверить
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openCreds(p)}>
                      <Pencil className="size-3.5 mr-1" /> Доступы
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(p.id)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Dialog open={!!credsPanel} onOpenChange={(o) => !o && setCredsPanel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Изменить доступы — {credsPanel?.name}</DialogTitle>
            <DialogDescription>Обновите URL, логин и пароль 3X-UI панели.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">URL панели</Label>
              <Input
                value={credsForm.panel_url}
                onChange={(e) => setCredsForm((f) => ({ ...f, panel_url: e.target.value }))}
                placeholder="https://1.2.3.4:54321/secret-path"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Логин</Label>
              <Input
                value={credsForm.username}
                onChange={(e) => setCredsForm((f) => ({ ...f, username: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Пароль</Label>
              <Input
                type="password"
                value={credsForm.password}
                onChange={(e) => setCredsForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Slug панели не меняется — все существующие подписки и инбаунды продолжат работать.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={testCreds} disabled={credsTesting || credsSaving}>
              {credsTesting ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Wifi className="size-4 mr-1" />}
              Проверить
            </Button>
            <Button onClick={saveCreds} disabled={credsSaving}>
              {credsSaving ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Check className="size-4 mr-1" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
