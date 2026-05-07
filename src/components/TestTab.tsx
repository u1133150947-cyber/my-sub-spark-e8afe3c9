import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, FlaskConical, Save, Trash2, ArrowUp, ArrowDown, RefreshCw, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type ParsedItem = {
  remark: string;
  protocol: string;
  host: string;
  port: number;
  uuid?: string;
  stream_settings: Record<string, unknown>;
};

type SubRow = { id: string; name: string; client_email: string; client_uuid: string };

type AssignedRow = {
  id: string;
  subscription_id: string;
  panel: string;
  inbound_id: number;
  remark: string;
  protocol: string;
  port: number;
  host: string;
  sort_order: number;
};

const DEFAULT_URL = "https://subs.vpnprime.ru/subs/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjQiLCJleHAiOjIwOTM1MjY1MzgsInNjb3BlIjoic3Vic2NyaXB0aW9uX2xpbmsiLCJzdWJzY3JpcHRpb25faWQiOjEyNCwidXNlcl9pZCI6Mn0.qOE9RBHojBvH331lHi222AZXE9zPcTOLYxC3DSKweBQ";

export function TestTab() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [subId, setSubId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [panelTag, setPanelTag] = useState("imported");
  const [assigned, setAssigned] = useState<AssignedRow[]>([]);
  const [filterSubId, setFilterSubId] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRemark, setEditRemark] = useState("");

  const loadAssigned = useCallback(async (sid?: string) => {
    let q = supabase.from("subscription_inbounds")
      .select("id,subscription_id,panel,inbound_id,remark,protocol,port,host,sort_order")
      .gte("inbound_id", 900000)
      .order("subscription_id", { ascending: true })
      .order("sort_order", { ascending: true });
    if (sid) q = q.eq("subscription_id", sid);
    const { data, error } = await q;
    if (error) { toast.error(error.message); return; }
    setAssigned((data as AssignedRow[]) ?? []);
  }, []);

  useEffect(() => {
    supabase.from("subscriptions").select("id,name,client_email,client_uuid").order("created_at", { ascending: false })
      .then(({ data }) => setSubs((data as SubRow[]) ?? []));
    loadAssigned();
  }, [loadAssigned]);

  const fetchSub = async () => {
    setLoading(true); setItems([]); setPicked(new Set());
    try {
      const { data, error } = await supabase.functions.invoke("import-sub", { body: { url } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const list = (data?.items ?? []) as ParsedItem[];
      setItems(list);
      setPicked(new Set(list.map((_, i) => i)));
      toast.success(`Получено ${list.length} конфигов (${data?.kind})`);
    } catch (e: any) {
      toast.error("Ошибка: " + (e?.message ?? e));
    } finally { setLoading(false); }
  };

  const toggle = (i: number) => {
    const n = new Set(picked);
    n.has(i) ? n.delete(i) : n.add(i);
    setPicked(n);
  };

  const assign = async () => {
    if (!subId) return toast.error("Выбери подписку");
    if (!picked.size) return toast.error("Ничего не выбрано");
    const sub = subs.find((s) => s.id === subId);
    if (!sub) return;
    setSaving(true);
    try {
      const rows = Array.from(picked).map((i, idx) => {
        const it = items[i];
        const ss = { ...(it.stream_settings as any), _clientUuid: it.uuid ?? "" };
        return {
          subscription_id: sub.id,
          panel: panelTag || "imported",
          inbound_id: 900000 + i, // synthetic id, won't collide with real x-ui inbounds
          remark: it.remark,
          protocol: it.protocol,
          port: it.port || 443,
          host: it.host,
          stream_settings: ss,
          client_email: sub.client_email,
          sort_order: idx,
        };
      });
      const { error } = await supabase.from("subscription_inbounds").insert(rows);
      if (error) throw error;
      toast.success(`Привязано ${rows.length} конфигов к "${sub.name}"`);
      await loadAssigned(filterSubId || undefined);
    } catch (e: any) {
      toast.error("Ошибка: " + (e?.message ?? e));
    } finally { setSaving(false); }
  };

  const subName = (id: string) => subs.find((s) => s.id === id)?.name ?? id.slice(0, 8);

  const removeRow = async (id: string) => {
    const { error } = await supabase.from("subscription_inbounds").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Удалено");
    await loadAssigned(filterSubId || undefined);
  };

  const removeAllForSub = async (sid: string) => {
    if (!confirm(`Удалить ВСЕ импортированные конфиги у "${subName(sid)}"?`)) return;
    const { error } = await supabase.from("subscription_inbounds")
      .delete().eq("subscription_id", sid).gte("inbound_id", 900000);
    if (error) return toast.error(error.message);
    toast.success("Очищено");
    await loadAssigned(filterSubId || undefined);
  };

  const move = async (row: AssignedRow, dir: -1 | 1) => {
    const sibs = assigned
      .filter((a) => a.subscription_id === row.subscription_id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = sibs.findIndex((a) => a.id === row.id);
    const swap = sibs[idx + dir];
    if (!swap) return;
    const a = supabase.from("subscription_inbounds").update({ sort_order: swap.sort_order }).eq("id", row.id);
    const b = supabase.from("subscription_inbounds").update({ sort_order: row.sort_order }).eq("id", swap.id);
    const [r1, r2] = await Promise.all([a, b]);
    if (r1.error || r2.error) return toast.error((r1.error || r2.error)!.message);
    await loadAssigned(filterSubId || undefined);
  };

  const startEdit = (r: AssignedRow) => { setEditingId(r.id); setEditRemark(r.remark); };
  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase.from("subscription_inbounds").update({ remark: editRemark }).eq("id", editingId);
    if (error) return toast.error(error.message);
    setEditingId(null);
    await loadAssigned(filterSubId || undefined);
  };

  const reassign = async (row: AssignedRow, newSubId: string) => {
    if (!newSubId || newSubId === row.subscription_id) return;
    const newSub = subs.find((s) => s.id === newSubId);
    if (!newSub) return;
    const { error } = await supabase.from("subscription_inbounds")
      .update({ subscription_id: newSubId, client_email: newSub.client_email })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success(`Перенесено к "${newSub.name}"`);
    await loadAssigned(filterSubId || undefined);
  };

  const visibleAssigned = filterSubId ? assigned.filter((a) => a.subscription_id === filterSubId) : assigned;
  const grouped = visibleAssigned.reduce<Record<string, AssignedRow[]>>((m, r) => {
    (m[r.subscription_id] ||= []).push(r); return m;
  }, {});

  return (
    <Card className="p-6 border-border space-y-5" style={{ background: "var(--gradient-card)" }}>
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
          <FlaskConical className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Тест: импорт чужой подписки</h2>
          <p className="text-xs text-muted-foreground">Только для эксперимента — основная логика не трогается.</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>URL подписки</Label>
        <div className="flex gap-2">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          <Button onClick={fetchSub} disabled={loading || !url}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Загрузить
          </Button>
        </div>
      </div>

      {items.length > 0 && (
        <>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Кому присвоить</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={subId}
                onChange={(e) => setSubId(e.target.value)}
              >
                <option value="">— выбери подписку —</option>
                {subs.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} · {s.client_email}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Метка панели (panel)</Label>
              <Input value={panelTag} onChange={(e) => setPanelTag(e.target.value)} placeholder="imported" />
            </div>
          </div>

          <div className="border border-border rounded-lg divide-y divide-border max-h-[420px] overflow-auto">
            {items.map((it, i) => (
              <label key={i} className="flex items-center gap-3 p-3 hover:bg-secondary/30 cursor-pointer">
                <Checkbox checked={picked.has(i)} onCheckedChange={() => toggle(i)} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{it.remark}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate">
                    {it.protocol} · {it.host}:{it.port}
                    {it.uuid ? ` · ${it.uuid.slice(0, 8)}…` : ""}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <Button onClick={assign} disabled={saving || !subId || !picked.size} className="w-full">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Привязать выбранные ({picked.size}) к подписке
          </Button>

          <p className="text-[11px] text-muted-foreground">
            Конфиги добавятся в <code>subscription_inbounds</code> с panel=<code>{panelTag}</code> и синтетическим inbound_id (900000+).
            Никакие реальные x-ui панели не трогаются. Удалить можно вручную из БД либо через редактор подписки.
          </p>
        </>
      )}

      <div className="border-t border-border pt-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold">Уже импортировано</h3>
            <p className="text-xs text-muted-foreground">Все конфиги с inbound_id ≥ 900000. Можно править, переносить, удалять.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={filterSubId}
              onChange={(e) => { setFilterSubId(e.target.value); loadAssigned(e.target.value || undefined); }}
            >
              <option value="">Все подписки</option>
              {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Button size="sm" variant="outline" onClick={() => loadAssigned(filterSubId || undefined)}>
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>

        {Object.keys(grouped).length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Импортированных конфигов пока нет.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([sid, rows]) => {
              const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);
              return (
                <div key={sid} className="border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between bg-secondary/40 px-3 py-2">
                    <div className="text-sm font-medium">
                      {subName(sid)} <span className="text-muted-foreground">· {sorted.length} конфигов</span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removeAllForSub(sid)}>
                      <Trash2 className="size-4" /> Очистить
                    </Button>
                  </div>
                  <div className="divide-y divide-border">
                    {sorted.map((r, i) => (
                      <div key={r.id} className="flex items-center gap-2 p-2 text-sm">
                        <div className="flex flex-col">
                          <button className="p-0.5 hover:text-primary disabled:opacity-30" disabled={i === 0} onClick={() => move(r, -1)}>
                            <ArrowUp className="size-3" />
                          </button>
                          <button className="p-0.5 hover:text-primary disabled:opacity-30" disabled={i === sorted.length - 1} onClick={() => move(r, 1)}>
                            <ArrowDown className="size-3" />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          {editingId === r.id ? (
                            <div className="flex gap-1">
                              <Input value={editRemark} onChange={(e) => setEditRemark(e.target.value)} className="h-8" />
                              <Button size="sm" onClick={saveEdit}><Check className="size-4" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="size-4" /></Button>
                            </div>
                          ) : (
                            <>
                              <div className="font-medium truncate">{r.remark}</div>
                              <div className="text-xs text-muted-foreground font-mono truncate">
                                {r.protocol} · {r.host}:{r.port} · panel={r.panel}
                              </div>
                            </>
                          )}
                        </div>
                        <select
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs max-w-[160px]"
                          value={r.subscription_id}
                          onChange={(e) => reassign(r, e.target.value)}
                          title="Перенести к другой подписке"
                        >
                          {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <Button size="sm" variant="ghost" onClick={() => startEdit(r)}><Pencil className="size-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => removeRow(r.id)}><Trash2 className="size-4" /></Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}