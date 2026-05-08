import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, RefreshCw, Link2, Globe2, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type ExternalSub = {
  id: string;
  name: string;
  emoji: string;
  source_url: string;
  raw_links: string[];
  notes: string;
  created_at: string;
};
type SubscriptionLite = { id: string; name: string };
type Link = { subscription_id: string; external_sub_id: string };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PANEL_FN = `${SUPABASE_URL}/functions/v1/panel`;

const COUNTRIES: { code: string; emoji: string; label: string }[] = [
  { code: "RU", emoji: "🇷🇺", label: "Россия" },
  { code: "CZ", emoji: "🇨🇿", label: "Чехия" },
  { code: "DE", emoji: "🇩🇪", label: "Германия" },
  { code: "AT", emoji: "🇦🇹", label: "Австрия" },
  { code: "NL", emoji: "🇳🇱", label: "Нидерланды" },
  { code: "US", emoji: "🇺🇸", label: "США" },
  { code: "GB", emoji: "🇬🇧", label: "Великобритания" },
  { code: "FR", emoji: "🇫🇷", label: "Франция" },
  { code: "FI", emoji: "🇫🇮", label: "Финляндия" },
  { code: "SE", emoji: "🇸🇪", label: "Швеция" },
  { code: "PL", emoji: "🇵🇱", label: "Польша" },
  { code: "TR", emoji: "🇹🇷", label: "Турция" },
  { code: "JP", emoji: "🇯🇵", label: "Япония" },
  { code: "SG", emoji: "🇸🇬", label: "Сингапур" },
  { code: "HK", emoji: "🇭🇰", label: "Гонконг" },
  { code: "KZ", emoji: "🇰🇿", label: "Казахстан" },
  { code: "BY", emoji: "🇧🇾", label: "Беларусь" },
  { code: "UA", emoji: "🇺🇦", label: "Украина" },
  { code: "OTHER", emoji: "🌍", label: "Другое" },
];

function rewriteLinkName(link: string, displayName: string): string {
  const s = link.trim();
  if (!s) return s;
  const hashIdx = s.indexOf("#");
  const base = hashIdx >= 0 ? s.slice(0, hashIdx) : s;
  return `${base}#${encodeURIComponent(displayName)}`;
}

export function ExternalSubsPanel() {
  const [items, setItems] = useState<ExternalSub[]>([]);
  const [subs, setSubs] = useState<SubscriptionLite[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  // form: single link add
  const [name, setName] = useState("");
  const [country, setCountry] = useState<string>("RU");
  const [linkText, setLinkText] = useState("");
  const [targetSubId, setTargetSubId] = useState<string>("none"); // "none" | "all" | <subId>
  const [creating, setCreating] = useState(false);

  const linksByExt = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of links) {
      if (!m.has(l.external_sub_id)) m.set(l.external_sub_id, new Set());
      m.get(l.external_sub_id)!.add(l.subscription_id);
    }
    return m;
  }, [links]);

  async function loadAll() {
    setLoading(true);
    try {
      const [ext, s, l] = await Promise.all([
        supabase.from("external_subs").select("*").order("created_at", { ascending: false }),
        supabase.from("subscriptions").select("id,name").order("created_at", { ascending: false }),
        supabase.from("subscription_external_subs").select("subscription_id,external_sub_id"),
      ]);
      if (ext.error) throw ext.error;
      if (s.error) throw s.error;
      if (l.error) throw l.error;
      setItems((ext.data ?? []).map((x: any) => ({ ...x, raw_links: Array.isArray(x.raw_links) ? x.raw_links : [] })));
      setSubs(s.data ?? []);
      setLinks(l.data ?? []);
    } catch (e: any) {
      toast.error("Не удалось загрузить", { description: e?.message ?? String(e) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function onCreate() {
    const link = linkText.trim();
    if (!name.trim()) { toast.error("Введите название"); return; }
    if (!link) { toast.error("Вставьте ключ (vless:// / hysteria2:// / vmess:// / trojan://)"); return; }
    if (!/^(vless|vmess|trojan|hysteria2|hy2|ss):\/\//i.test(link)) {
      toast.error("Неподдерживаемый формат ключа");
      return;
    }
    setCreating(true);
    try {
      const c = COUNTRIES.find((x) => x.code === country) ?? COUNTRIES[0];
      const displayName = `${c.emoji} ${name.trim()}`;
      const finalLink = rewriteLinkName(link, displayName);
      const { data, error } = await supabase.from("external_subs").insert({
        name: name.trim(), emoji: c.emoji,
        source_url: "", raw_links: [finalLink], notes: "",
      }).select("id").single();
      if (error) throw error;
      const createdId = Array.isArray(data) ? (data[0] as any)?.id : (data as any)?.id;
      if (!createdId) throw new Error("Сервер добавлен, но не удалось получить ID для привязки");
      if (createdId) {
        if (targetSubId === "all" && subs.length) {
          const rows = subs.map((s) => ({ subscription_id: s.id, external_sub_id: createdId }));
          const r = await supabase.from("subscription_external_subs").insert(rows);
          if (r.error && !/duplicate|unique/i.test(r.error.message)) throw r.error;
          toast.success(`Привязано ко всем (${subs.length})`);
        } else if (targetSubId !== "none") {
          const r = await supabase.from("subscription_external_subs").insert({
            subscription_id: targetSubId, external_sub_id: createdId,
          });
          if (r.error && !/duplicate|unique/i.test(r.error.message)) throw r.error;
          const subName = subs.find((s) => s.id === targetSubId)?.name ?? "";
          toast.success(`Сервер добавлен и привязан${subName ? ` к «${subName}»` : ""}`);
        } else {
          toast.success("Сервер добавлен");
        }
      }
      setName(""); setCountry("RU"); setLinkText(""); setTargetSubId("none");
      loadAll();
    } catch (e: any) {
      toast.error("Ошибка добавления", { description: e?.message ?? String(e) });
    } finally {
      setCreating(false);
    }
  }

  async function attachAll(extId: string) {
    if (!subs.length) { toast.error("Нет подписок"); return; }
    setBusy(extId);
    try {
      const rows = subs.map((s) => ({ subscription_id: s.id, external_sub_id: extId }));
      const r = await supabase.from("subscription_external_subs").insert(rows);
      if (r.error && !/duplicate|unique/i.test(r.error.message)) throw r.error;
      toast.success(`Привязано ко всем (${subs.length})`);
      loadAll();
    } catch (e: any) {
      toast.error("Не удалось", { description: e?.message ?? String(e) });
    } finally { setBusy(null); }
  }

  async function detachAll(extId: string) {
    setBusy(extId);
    try {
      const r = await supabase.from("subscription_external_subs").delete().eq("external_sub_id", extId);
      if (r.error) throw r.error;
      toast.success("Отвязано у всех");
      loadAll();
    } catch (e: any) {
      toast.error("Не удалось", { description: e?.message ?? String(e) });
    } finally { setBusy(null); }
  }

  async function onRefresh(item: ExternalSub) {
    if (!item.source_url) { toast.error("У записи нет URL для обновления"); return; }
    setBusy(item.id);
    try {
      const r = await fetch(`${PANEL_FN}?action=parseExternal`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: item.source_url }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error ?? `HTTP ${r.status}`);
      const fresh: string[] = j.links ?? [];
      if (!fresh.length) { toast.error("Источник пуст"); return; }
      const { error } = await supabase.from("external_subs").update({ raw_links: fresh }).eq("id", item.id);
      if (error) throw error;
      toast.success(`Обновлено: ${fresh.length}`);
      loadAll();
    } catch (e: any) {
      toast.error("Ошибка обновления", { description: e?.message ?? String(e) });
    } finally { setBusy(null); }
  }

  async function onDelete(id: string) {
    if (!confirm("Удалить эту стороннюю подписку и все её привязки?")) return;
    setBusy(id);
    try {
      await supabase.from("subscription_external_subs").delete().eq("external_sub_id", id);
      const { error } = await supabase.from("external_subs").delete().eq("id", id);
      if (error) throw error;
      toast.success("Удалено");
      loadAll();
    } catch (e: any) {
      toast.error("Ошибка удаления", { description: e?.message ?? String(e) });
    } finally { setBusy(null); }
  }

  async function toggleAttach(extId: string, subId: string, attach: boolean) {
    try {
      if (attach) {
        const { error } = await supabase.from("subscription_external_subs").insert({ subscription_id: subId, external_sub_id: extId });
        if (error && !/duplicate|unique/i.test(error.message)) throw error;
      } else {
        const { error } = await supabase.from("subscription_external_subs").delete()
          .eq("subscription_id", subId).eq("external_sub_id", extId);
        if (error) throw error;
      }
      loadAll();
    } catch (e: any) {
      toast.error("Не удалось", { description: e?.message ?? String(e) });
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 border-border" style={{ background: "var(--gradient-card)" }}>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Globe2 className="size-4 text-primary" /> Добавить сторонний сервер
        </h2>
        <div className="grid md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <Label>Страна (флаг для пользователей)</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите страну" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code} textValue={`${c.emoji} ${c.label}`}>
                    <span className="mr-2">{c.emoji}</span>{c.label}
                    <span className="ml-2 text-xs text-muted-foreground">{c.code}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Название сервера (видит клиент после флага)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="США-каскад" />
          </div>
          <div className="md:col-span-2">
            <Label>Привязать к подписке</Label>
            <Select value={targetSubId} onValueChange={setTargetSubId}>
              <SelectTrigger><SelectValue placeholder="Выберите подписку" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— не привязывать —</SelectItem>
                <SelectItem value="all">★ Добавить всем подпискам</SelectItem>
                {subs.map((s) => (
                  <SelectItem key={s.id} value={s.id} textValue={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-6">
            <Label>Ключ (vless:// / hysteria2:// / vmess:// / trojan://)</Label>
            <Textarea value={linkText} onChange={(e) => setLinkText(e.target.value)} rows={3}
              placeholder="vless://uuid@host:443?...#name" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Имя ссылки (после <code>#</code>) автоматически переписывается в «{`{флаг} {название}`}», например 🇺🇸 США-каскад.
        </p>
        <div className="mt-4">
          <Button onClick={onCreate} disabled={creating}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Добавить сервер
          </Button>
        </div>
      </Card>

      <Card className="p-6 border-border" style={{ background: "var(--gradient-card)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Link2 className="size-4 text-primary" /> Сторонние подписки ({items.length})
          </h2>
          <Button size="sm" variant="outline" onClick={loadAll} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          </Button>
        </div>
        {!items.length && (
          <div className="text-sm text-muted-foreground py-8 text-center">Пока нет сторонних подписок.</div>
        )}
        <div className="space-y-3">
          {items.map((it) => {
            const attached = linksByExt.get(it.id) ?? new Set<string>();
            const isOpen = expanded.has(it.id);
            return (
              <div key={it.id} className="rounded-lg border border-border bg-background/40">
                <div className="flex items-center justify-between gap-3 p-3">
                  <button
                    className="flex items-center gap-3 text-left flex-1 min-w-0"
                    onClick={() => {
                      const n = new Set(expanded);
                      n.has(it.id) ? n.delete(it.id) : n.add(it.id);
                      setExpanded(n);
                    }}
                  >
                    {isOpen ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                    <span className="text-2xl">{it.emoji || "🌐"}</span>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{it.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {it.raw_links.length} серверов · привязок: {attached.size}
                        {it.source_url ? ` · ${new URL(it.source_url).host}` : ""}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled={busy === it.id || !subs.length}
                      onClick={() => attachAll(it.id)} title="Привязать ко всем подпискам">
                      Всем
                    </Button>
                    {attached.size > 0 && (
                      <Button size="sm" variant="outline" disabled={busy === it.id}
                        onClick={() => detachAll(it.id)} title="Отвязать у всех">
                        Отвязать
                      </Button>
                    )}
                    {it.source_url && (
                      <Button size="sm" variant="outline" disabled={busy === it.id} onClick={() => onRefresh(it)} title="Обновить из источника">
                        {busy === it.id ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" disabled={busy === it.id} onClick={() => onDelete(it.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t border-border p-3 space-y-3">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-2">Привязать к подпискам:</div>
                      {!subs.length && <div className="text-xs text-muted-foreground">Сначала создайте подписки.</div>}
                      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {subs.map((s) => (
                          <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={attached.has(s.id)}
                              onCheckedChange={(v) => toggleAttach(it.id, s.id, !!v)}
                            />
                            <span className="truncate">{s.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground">Ссылки ({it.raw_links.length})</summary>
                      <div className="mt-2 space-y-1 max-h-60 overflow-auto">
                        {it.raw_links.map((l, i) => (
                          <div key={i} className="font-mono break-all p-1.5 rounded bg-background/60 border border-border">
                            {l}
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
