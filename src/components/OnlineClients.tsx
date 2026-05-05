import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Wifi, User } from "lucide-react";
import { toast } from "sonner";

type Online = {
  panel: "cz" | "ru";
  email: string;
  subscription_id: string | null;
  sub_name: string | null;
  remark: string | null;
};

const PANEL_LABEL: Record<string, string> = { cz: "🇨🇿 Чехия", ru: "🇷🇺 Россия" };

export const OnlineClients = () => {
  const [items, setItems] = useState<Online[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

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
            {Object.entries(errors).map(([k, v]) => <div key={k}>{PANEL_LABEL[k] || k}: {v}</div>)}
          </div>
        )}

        {items.length === 0 && !loading ? (
          <div className="text-center text-muted-foreground py-8">Никто не подключён</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(grouped).map(([panel, list]) => (
              <Card key={panel} className="p-4 bg-secondary/40 border-border">
                <div className="font-semibold mb-3 flex items-center justify-between">
                  <span>{PANEL_LABEL[panel] || panel}</span>
                  <span className="text-xs text-muted-foreground">{list.length}</span>
                </div>
                <div className="space-y-2">
                  {list.map((o, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-background/40">
                      <span className="size-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                      <User className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{o.sub_name ?? o.email}</span>
                      {o.remark && (
                        <span className="text-xs text-muted-foreground ml-auto truncate">{o.remark}</span>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-4">Обновляется автоматически каждые 15 сек.</p>
      </Card>
    </div>
  );
};