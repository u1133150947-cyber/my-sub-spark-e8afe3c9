import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Plus, Trash2, Link2, Smartphone, Zap, Loader2, Server, RefreshCw, Pencil, X, Check, Share2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { StatsDashboard } from "@/components/StatsDashboard";
import { PanelsManager } from "@/components/PanelsManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Subscription = {
  id: string;
  slug: string;
  name: string;
  client_email: string;
  expiry_ms: number;
  total_bytes: number;
  hits: number;
  created_at: string;
};

type InboundInfo = { id: number; remark: string; protocol: string; port: number; enable: boolean };
type PanelKey = "cz" | "ru";
type InboundsResp = Record<PanelKey, InboundInfo[] | { error: string }>;
type SubInbound = { panel: PanelKey; inbound_id: number; remark: string };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const subUrl = (slug: string) => `${SUPABASE_URL}/functions/v1/sub/${slug}`;
const happUrl = (slug: string) => `happ://add/${encodeURIComponent(subUrl(slug))}`;

const PANEL_LABEL: Record<PanelKey, string> = { cz: "🇨🇿 Чехия", ru: "🇷🇺 Россия" };

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
  const [savingEdit, setSavingEdit] = useState(false);

  const loadSubs = async () => {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("id, slug, name, client_email, expiry_ms, total_bytes, hits, created_at")
      .order("created_at", { ascending: false });
    if (error) return toast.error("Не удалось загрузить подписки");
    setSubs(data ?? []);
  };

  const loadInbounds = async () => {
    setLoadingInbounds(true);
    try {
      const { data, error } = await supabase.functions.invoke("panel?action=inbounds", {
        method: "GET",
      });
      if (error) throw error;
      setInbounds(data);
    } catch (e: any) {
      toast.error("Ошибка загрузки inbound'ов: " + (e?.message ?? e));
    } finally {
      setLoadingInbounds(false);
    }
  };

  useEffect(() => {
    loadSubs();
    loadInbounds();
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

  const openEdit = async (s: Subscription) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditDays("");
    setEditGB("");
    const { data } = await supabase
      .from("subscription_inbounds")
      .select("panel, inbound_id, remark")
      .eq("subscription_id", s.id);
    const keys = new Set((data ?? []).map((l: any) => `${l.panel}:${l.inbound_id}`));
    setEditExisting(keys);
    setEditSelected(new Set(keys));
  };

  const closeEdit = () => {
    setEditingId(null);
    setEditSelected(new Set());
    setEditExisting(new Set());
  };

  const toggleEdit = (key: string) => {
    setEditSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const saveEdit = async (s: Subscription) => {
    setSavingEdit(true);
    try {
      // Compute additions and removals
      const toAdd: { panel: PanelKey; inboundId: number }[] = [];
      const toRemove: { panel: PanelKey; inboundId: number }[] = [];
      editSelected.forEach((k) => {
        if (!editExisting.has(k)) {
          const [p, id] = k.split(":");
          toAdd.push({ panel: p as PanelKey, inboundId: Number(id) });
        }
      });
      editExisting.forEach((k) => {
        if (!editSelected.has(k)) {
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

      toast.success("Подписка обновлена");
      closeEdit();
      loadSubs();
    } catch (e: any) {
      toast.error("Ошибка: " + (e?.message ?? e));
    } finally {
      setSavingEdit(false);
    }
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
      <header className="relative overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 opacity-20"
          style={{ background: "var(--gradient-hero)" }}
          aria-hidden
        />
        <div className="container relative py-10 md:py-14">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="size-10 rounded-xl flex items-center justify-center"
              style={{ background: "var(--gradient-hero)" }}
            >
              <Zap className="size-5 text-primary-foreground" />
            </div>
            <span className="text-sm uppercase tracking-widest text-muted-foreground">
              3X-UI Sub Manager
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight max-w-2xl">
            Создавайте подписки для{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "var(--gradient-hero)" }}
            >
              Happ
            </span>{" "}
            одной кнопкой
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl">
            Подключено к вашим панелям 3X-UI. Создание клиентов, генерация ссылок и удаление — без входа в админки.
          </p>
        </div>
      </header>

      <main className="container py-8">
        <Tabs defaultValue="subs" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="stats">📊 Статистика</TabsTrigger>
            <TabsTrigger value="create">➕ Новый</TabsTrigger>
            <TabsTrigger value="subs">🔑 Подписки</TabsTrigger>
            <TabsTrigger value="servers">🖥️ Панели</TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="mt-0">
            <StatsDashboard />
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
            {(["cz", "ru"] as PanelKey[]).map((panel) => {
              const list = inbounds?.[panel];
              return (
                <Card key={panel} className="p-4 bg-secondary/40 border-border">
                  <div className="flex items-center gap-2 mb-3 font-semibold">
                    <Server className="size-4 text-primary" />
                    {PANEL_LABEL[panel]}
                  </div>
                  {!inbounds && <div className="text-sm text-muted-foreground">Загрузка…</div>}
                  {Array.isArray(list) ? (
                    list.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Нет inbound'ов</div>
                    ) : (
                      <div className="space-y-2">
                        {list.map((ib) => {
                          const key = `${panel}:${ib.id}`;
                          return (
                            <label key={key} className="flex items-center gap-3 cursor-pointer">
                              <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm truncate">{ib.remark || `inbound #${ib.id}`}</div>
                                <div className="text-xs text-muted-foreground">
                                  {ib.protocol.toUpperCase()} · :{ib.port}
                                </div>
                              </div>
                            </label>
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
          <h2 className="text-lg font-semibold mb-4">Подписки ({subs.length})</h2>
          {subs.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground border-dashed">
              Подписок пока нет.
            </Card>
          ) : (
            <div className="grid gap-3">
              {subs.map((s) => {
                const url = subUrl(s.slug);
                const happ = happUrl(s.slug);
                const status = expiryStatus(s);
                return (
                  <Card key={s.id} className="p-4 border-border" style={{ background: "var(--gradient-card)" }}>
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
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
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button variant="secondary" size="sm" onClick={() => copy(url)}>
                          <Copy className="size-3.5 mr-1" /> URL
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              style={{ background: "var(--gradient-hero)", color: "hsl(var(--primary-foreground))" }}
                            >
                              <Share2 className="size-3.5 mr-1" /> Открыть в…
                              <ChevronDown className="size-3 ml-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Импорт в клиент</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {CLIENT_LINKS.map((c) => {
                              const link = c.build(url);
                              return (
                                <DropdownMenuItem key={c.label} asChild>
                                  <a href={link} className="cursor-pointer flex items-center justify-between gap-2">
                                    <span>
                                      <span className="mr-2">{c.emoji}</span>
                                      {c.label}
                                    </span>
                                    <Copy
                                      className="size-3.5 text-muted-foreground hover:text-foreground"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        copy(link);
                                      }}
                                    />
                                  </a>
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
                            {(["cz", "ru"] as PanelKey[]).map((panel) => {
                              const list = inbounds?.[panel];
                              return (
                                <Card key={panel} className="p-3 bg-background border-border">
                                  <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                                    <Server className="size-3.5 text-primary" />
                                    {PANEL_LABEL[panel]}
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
                                                {ib.remark || `inbound #${ib.id}`}
                                                {wasExisting && (
                                                  <span className="ml-2 text-[10px] uppercase text-muted-foreground">активно</span>
                                                )}
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
              })}
            </div>
          )}
        </section>
          </TabsContent>

          <TabsContent value="servers" className="mt-0">
            <PanelsManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
