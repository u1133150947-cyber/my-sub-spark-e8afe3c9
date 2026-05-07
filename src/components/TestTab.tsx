import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, FlaskConical, Save } from "lucide-react";
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

  useEffect(() => {
    supabase.from("subscriptions").select("id,name,client_email,client_uuid").order("created_at", { ascending: false })
      .then(({ data }) => setSubs((data as SubRow[]) ?? []));
  }, []);

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
        return {
          subscription_id: sub.id,
          panel: panelTag || "imported",
          inbound_id: 900000 + i, // synthetic id, won't collide with real x-ui inbounds
          remark: it.remark,
          protocol: it.protocol,
          port: it.port || 443,
          host: it.host,
          stream_settings: it.stream_settings,
          client_email: sub.client_email,
          sort_order: idx,
        };
      });
      const { error } = await supabase.from("subscription_inbounds").insert(rows);
      if (error) throw error;
      toast.success(`Привязано ${rows.length} конфигов к "${sub.name}"`);
    } catch (e: any) {
      toast.error("Ошибка: " + (e?.message ?? e));
    } finally { setSaving(false); }
  };

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
    </Card>
  );
}