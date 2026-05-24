import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ServerCrash, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type ExpiringSub = { id: string; name: string; slug: string; expiry_ms: number };
type OfflinePanel = { slug: string; name: string; status: string; status_message: string };

const DAY = 24 * 60 * 60 * 1000;

export function DashboardAlerts() {
  const [expiring, setExpiring] = useState<ExpiringSub[]>([]);
  const [offline, setOffline] = useState<OfflinePanel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const now = Date.now();
        const horizon = now + 7 * DAY;
        const [subsRes, panelsRes] = await Promise.all([
          supabase
            .from("subscriptions")
            .select("id, name, slug, expiry_ms")
            .gt("expiry_ms", 0)
            .lte("expiry_ms", horizon)
            .order("expiry_ms", { ascending: true })
            .limit(20),
          supabase
            .from("panels")
            .select("slug, name, status, status_message")
            .not("status", "in", "(ok,unknown,auto)"),
        ]);
        if (cancelled) return;
        setExpiring((subsRes.data ?? []) as ExpiringSub[]);
        setOffline(((panelsRes.data ?? []) as OfflinePanel[]).filter(
          (p) => p.status && p.status !== "ok" && p.status !== "unknown",
        ));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return null;
  if (expiring.length === 0 && offline.length === 0) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {expiring.length > 0 && (
        <Card className="p-4 border-amber-500/40" style={{ background: "var(--gradient-card)" }}>
          <div className="flex items-center gap-2 text-sm font-semibold mb-3 text-amber-400">
            <Clock className="size-4" />
            Истекают в ближайшие 7 дней ({expiring.length})
          </div>
          <ul className="space-y-1.5 text-sm">
            {expiring.slice(0, 6).map((s) => {
              const days = Math.max(0, Math.ceil((s.expiry_ms - Date.now()) / DAY));
              return (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <Link
                    to={`/subs?q=${encodeURIComponent(s.slug)}`}
                    className="truncate hover:text-primary"
                  >
                    {s.name || s.slug}
                  </Link>
                  <span className={`text-xs tabular-nums shrink-0 ${days <= 1 ? "text-destructive font-semibold" : "text-amber-400"}`}>
                    {days === 0 ? "сегодня" : `${days} д.`}
                  </span>
                </li>
              );
            })}
            {expiring.length > 6 && (
              <li className="text-xs text-muted-foreground pt-1">
                +{expiring.length - 6} ещё…
              </li>
            )}
          </ul>
        </Card>
      )}

      {offline.length > 0 && (
        <Card className="p-4 border-destructive/40" style={{ background: "var(--gradient-card)" }}>
          <div className="flex items-center gap-2 text-sm font-semibold mb-3 text-destructive">
            <ServerCrash className="size-4" />
            Панели с проблемами ({offline.length})
          </div>
          <ul className="space-y-1.5 text-sm">
            {offline.map((p) => (
              <li key={p.slug} className="flex items-center justify-between gap-2">
                <Link to="/panels" className="truncate hover:text-primary">{p.name || p.slug}</Link>
                <span className="text-xs text-destructive shrink-0 max-w-[50%] truncate" title={p.status_message}>
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {expiring.length === 0 && offline.length === 0 && (
        <Card className="p-4 border-border col-span-full" style={{ background: "var(--gradient-card)" }}>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="size-4 opacity-50" />
            Проблем не обнаружено
          </div>
        </Card>
      )}
    </div>
  );
}