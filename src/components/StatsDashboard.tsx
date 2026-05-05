import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, ArrowDown, ArrowUp, BarChart3, Crown, Loader2, RefreshCw, TrendingUp, Users } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

type PerSub = { id: string; name: string; up: number; down: number; total: number };
type Snapshot = { subscription_id: string; used_bytes: number; created_at: string };

const fmtBytes = (b: number) => {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = b;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${u[i]}`;
};

export const StatsDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [perSub, setPerSub] = useState<PerSub[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("panel?action=stats", { method: "GET" });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPerSub((data?.perSub ?? []).sort((a: PerSub, b: PerSub) => b.total - a.total));
      setUpdatedAt(new Date());

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: snaps } = await supabase
        .from("traffic_snapshots")
        .select("subscription_id, used_bytes, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: true });
      setSnapshots((snaps ?? []) as Snapshot[]);
    } catch (e: any) {
      toast.error("Ошибка статистики: " + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    const total = perSub.reduce((s, x) => s + x.total, 0);
    const up = perSub.reduce((s, x) => s + x.up, 0);
    const down = perSub.reduce((s, x) => s + x.down, 0);
    const active = perSub.filter((x) => x.total > 0).length;
    return { total, up, down, active };
  }, [perSub]);

  // Build hourly chart for last 24h: aggregated bytes used per hour (delta of cumulative totals)
  const chartData = useMemo(() => {
    if (snapshots.length === 0) return [];
    // Group cumulative totals per timestamp (sum across subscriptions)
    const buckets = new Map<number, number>();
    for (const s of snapshots) {
      const t = new Date(s.created_at).getTime();
      const hour = Math.floor(t / (60 * 60 * 1000)) * (60 * 60 * 1000);
      buckets.set(hour, (buckets.get(hour) ?? 0) + Number(s.used_bytes));
    }
    const sorted = Array.from(buckets.entries()).sort(([a], [b]) => a - b);
    // For each bucket take the LATEST cumulative sum, then compute deltas
    // Simpler: per bucket sum is already cumulative-sum at that snapshot time
    const out: { time: string; bytes: number }[] = [];
    let prev: number | null = null;
    for (const [hour, sum] of sorted) {
      const delta = prev === null ? 0 : Math.max(0, sum - prev);
      out.push({
        time: new Date(hour).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
        bytes: delta,
      });
      prev = sum;
    }
    return out;
  }, [snapshots]);

  const top = perSub.slice(0, 5);
  const maxTotal = top[0]?.total ?? 0;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="size-5 text-primary" />
          Статистика трафика
        </h2>
        <div className="flex items-center gap-2">
          {updatedAt && (
            <span className="text-xs text-muted-foreground">
              обновлено: {updatedAt.toLocaleTimeString("ru-RU")}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatCard icon={<Activity className="size-4" />} label="Всего трафика" value={fmtBytes(totals.total)} accent />
        <StatCard icon={<ArrowDown className="size-4" />} label="Загружено" value={fmtBytes(totals.down)} />
        <StatCard icon={<ArrowUp className="size-4" />} label="Отправлено" value={fmtBytes(totals.up)} />
        <StatCard icon={<Users className="size-4" />} label="Активных" value={`${totals.active} / ${perSub.length}`} />
      </div>

      <Card className="p-4 border-border" style={{ background: "var(--gradient-card)" }}>
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
          <TrendingUp className="size-4 text-primary" />
          Динамика за 24 часа
        </div>
        {chartData.length < 2 ? (
          <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
            Накапливаем данные… снапшоты собираются при каждом обновлении.
          </div>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="trafficGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => fmtBytes(Number(v))}
                  width={70}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  formatter={(v: number) => [fmtBytes(Number(v)), "Прирост"]}
                />
                <Area type="monotone" dataKey="bytes" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#trafficGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="p-4 border-border" style={{ background: "var(--gradient-card)" }}>
        <div className="flex items-center gap-2 mb-4 text-sm font-semibold">
          <Crown className="size-4 text-primary" />
          Топ потребителей
        </div>
        {top.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            {loading ? <Loader2 className="size-4 animate-spin mx-auto" /> : "Пока нет данных"}
          </div>
        ) : (
          <ol className="space-y-3">
            {top.map((c, i) => {
              const pct = maxTotal > 0 ? (c.total / maxTotal) * 100 : 0;
              return (
                <li key={c.id}>
                  <div className="flex items-center justify-between mb-1 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`size-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                        {i + 1}
                      </span>
                      <span className="truncate font-medium">{c.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">{fmtBytes(c.total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: "var(--gradient-hero)" }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </section>
  );
};

const StatCard = ({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) => (
  <Card
    className="p-4 border-border"
    style={accent ? { background: "var(--gradient-hero)" } : { background: "var(--gradient-card)" }}
  >
    <div className={`flex items-center gap-1.5 text-xs mb-1 ${accent ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
      {icon}
      {label}
    </div>
    <div className={`text-xl font-bold tabular-nums ${accent ? "text-primary-foreground" : ""}`}>{value}</div>
  </Card>
);