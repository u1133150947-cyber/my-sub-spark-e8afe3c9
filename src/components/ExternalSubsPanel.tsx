import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, RefreshCw, Link2, Globe2, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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

export function ExternalSubsPanel() {
  const [items, setItems] = useState<ExternalSub[]>([]);
  const [subs, setSubs] = useState<SubscriptionLite[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  // form
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🌐");
  const [sourceUrl, setSourceUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
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

  async function parseLinks(): Promise<string[]> {
    const r = await fetch(`${PANEL_FN}?action=parseExternal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: sourceUrl, text: pasteText }),
    });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error ?? `HTTP ${r.status}`);
    return j.links ?? [];
  }

  async function onCreate() {
    if (!name.trim()) { toast.error("Введите название"); return; }
    if (!sourceUrl.trim() && !pasteText.trim()) { toast.error("Укажите URL или вставьте ключи"); return; }
    setCreating(true);
    try {
      const linksParsed = await parseLinks();
      if (!linksParsed.length) { toast.error("Не удалось извлечь ни одной ссылки"); return; }
      const { error } = await supabase.from("external_subs").insert({
        name: name.trim(), emoji: emoji.trim() || "🌐",
        source_url: sourceUrl.trim(), raw_links: linksParsed, notes: "",
      });
      if (error) throw error;
      toast.success(`Добавлено: ${linksParsed.length} серверов`);
      setName(""); setEmoji("🌐"); setSourceUrl(""); setPasteText("");
      loadAll();
    } catch (e: any) {
      toast.error("Ошибка добавления", { description: e?.message ?? String(e) });
    } finally {
      setCreating(false);
    }
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
          <Globe2 className="size-4 text-primary" /> Добавить стороннюю подписку
        </h2>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label>Название</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VPN Prime" />
          </div>
          <div>
            <Label>Эмодзи / иконка</Label>
            <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🌐" maxLength={4} />
          </div>
          <div className="md:col-span-3">
            <Label>URL подписки</Label>
            <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://subs.vpnprime.ru/subs/..." />
          </div>
          <div className="md:col-span-3">
            <Label>… или вставьте ключи (vless://, vmess://, hysteria2://, либо xray-JSON)</Label>
            <Textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={4}
              placeholder="vless://...&#10;hysteria2://..." />
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={onCreate} disabled={creating}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Распарсить и добавить
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
