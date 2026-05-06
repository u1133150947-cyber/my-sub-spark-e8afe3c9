import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Wifi, User, Link2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Online = {
  panel: string;
  email: string;
  subscription_id: string | null;
  sub_name: string | null;
  remark: string | null;
};

type Sub = { id: string; name: string };
type PanelMeta = { id: string; slug: string; name: string };

export const OnlineClients = () => {
  const [items, setItems] = useState<Online[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [subs, setSubs] = useState<Sub[]>([]);
  const [linkTarget, setLinkTarget] = useState<Online | null>(null);
  const [selectedSub, setSelectedSub] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [panels, setPanels] = useState<PanelMeta[]>([]);
  const PANEL_LABEL = (slug: string) => panels.find((p) => p.slug === slug)?.name ?? slug;

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("panel?action=onlines", { method: "GET" });
      if (error) throw error;
      setItems(data?.onlines ?? []);
      setErrors(data?.errors ?? {});
    } catch (e: any) {
      toast.error("Ошибка: " + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const loadSubs = async () => {
    const { data } = await supabase.from("subscriptions").select("id, name").order("name");
    setSubs(data ?? []);
  };

  const loadPanels = async () => {
    const { data } = await supabase.from("panels").select("id, slug, name").order("created_at");
    setPanels((data ?? []) as PanelMeta[]);
  };

  useEffect(() => {
    load();
    loadSubs();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const openLink = (o: Online) => {
    setLinkTarget(o);
    setSelectedSub(o.subscription_id ?? "");
  };

  const saveLink = async () => {
    if (!linkTarget) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("client_mappings")
        .upsert(
          {
            panel: linkTarget.panel,
            client_email: linkTarget.email,
            subscription_id: selectedSub || null,
          },
          { onConflict: "panel,client_email" },
        );
      if (error) throw error;
      toast.success("Привязка сохранена");
      setLinkTarget(null);
      load();
    } catch (e: any) {
      toast.error("Ошибка: " + (e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const grouped = items.reduce<Record<string, Online[]>>((acc, o) => {
    (acc[o.panel] ||= []).push(o);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <Card className="p-6 border-border" style={{ background: "var(--gradient-card)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Wifi className="size-4 text-primary" />
            Онлайн сейчас ({items.length})
          </h2>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        </div>

        {Object.keys(errors).length > 0 && (
          <div className="text-xs text-destructive mb-3">
            {Object.entries(errors).map(([k, v]) => <div key={k}>{PANEL_LABEL(k)}: {v}</div>)}
          </div>
        )}

        {items.length === 0 && !loading ? (
          <div className="text-center text-muted-foreground py-8">Никто не подключён</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(grouped).map(([panel, list]) => (
              <Card key={panel} className="p-4 bg-secondary/40 border-border">
                <div className="font-semibold mb-3 flex items-center justify-between">
                  <span>{PANEL_LABEL(panel)}</span>
                  <span className="text-xs text-muted-foreground">{list.length}</span>
                </div>
                <div className="space-y-2">
                  {list.map((o, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-background/40 group">
                      <span className="size-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                      <User className="size-3.5 text-muted-foreground shrink-0" />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-medium truncate">{o.sub_name ?? "— не привязан"}</span>
                        <span className="text-xs text-muted-foreground truncate">{o.email}</span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 opacity-60 hover:opacity-100"
                        onClick={() => openLink(o)}
                        title="Привязать к подписке"
                      >
                        <Link2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-4">Обновляется автоматически каждые 15 сек.</p>
      </Card>

      <Dialog open={!!linkTarget} onOpenChange={(o) => !o && setLinkTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Привязать клиента</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-muted-foreground text-xs mb-1">Сервер / email</div>
              <div className="font-mono">{linkTarget && PANEL_LABEL(linkTarget.panel)} · {linkTarget?.email}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-1">Подписка</div>
              <Select value={selectedSub} onValueChange={setSelectedSub}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите подписку" />
                </SelectTrigger>
                <SelectContent>
                  {subs.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLinkTarget(null)}>Отмена</Button>
            <Button onClick={saveLink} disabled={saving || !selectedSub}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};