import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, ArrowDown, ArrowUp, BarChart3, Crown, Loader2, RefreshCw, TrendingUp, Users, Clock } from "lucide-react";
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
    // Per subscription: compute deltas between consecutive cumulative snapshots,
    // then SPREAD positive deltas proportionally across the hourly buckets
    // they span. Without this, a long gap between refreshes dumps all the
    // accumulated traffic into a single hour and produces fake spikes.
    const HOUR = 60 * 60 * 1000;
    const bySub = new Map<string, Snapshot[]>();
    for (const s of snapshots) {
      const arr = bySub.get(s.subscription_id) ?? [];
      arr.push(s);
      bySub.set(s.subscription_id, arr);
    }
    const buckets = new Map<number, number>();
    const windowStart = Date.now() - 24 * 60 * 60 * 1000;
    for (const arr of bySub.values()) {
      arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      for (let i = 1; i < arr.length; i++) {
        const delta = Number(arr[i].used_bytes) - Number(arr[i - 1].used_bytes);
        if (delta <= 0) continue; // counter reset / no growth
        const tA = new Date(arr[i - 1].created_at).getTime();
        const tB = new Date(arr[i].created_at).getTime();
        const span = Math.max(1, tB - tA);
        // Clip to the visible 24h window so an old previous snapshot doesn't
        // dilute today's traffic across yesterday.
        const from = Math.max(tA, windowStart);
        const to = tB;
        if (to <= from) continue;
        const effectiveDelta = delta * ((to - from) / span);
        // Walk each hour bucket the [from, to) interval touches and assign
        // a portion proportional to the overlap.
        let cursor = from;
        while (cursor < to) {
          const bucketStart = Math.floor(cursor / HOUR) * HOUR;
          const bucketEnd = bucketStart + HOUR;
          const overlap = Math.min(to, bucketEnd) - cursor;
          const portion = effectiveDelta * (overlap / (to - from));
          buckets.set(bucketStart, (buckets.get(bucketStart) ?? 0) + portion);
          cursor = bucketEnd;
        }
      }
    }
    // Fill hourly slots up to the last actual snapshot we have. Without this,
    // если снапшоты не собирались последние часы (никто не открывал
    // статистику), хвост графика тянется в ноль и выглядит как «сломанный».
    const now = Date.now();
    let lastSnapTs = 0;
    for (const s of snapshots) {
      const t = new Date(s.created_at).getTime();
      if (t > lastSnapTs) lastSnapTs = t;
    }
    const endRef = lastSnapTs > 0 ? Math.min(lastSnapTs, now) : now;
    const endHour = Math.floor(endRef / HOUR) * HOUR;
    const startHour = endHour - 23 * HOUR;
    const out: { time: string; bytes: number }[] = [];
    for (let h = startHour; h <= endHour; h += HOUR) {
      out.push({
        time: new Date(h).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
        bytes: buckets.get(h) ?? 0,
      });
    }
    return out;
  }, [snapshots]);

  const top = perSub.slice(0, 5);
  const maxTotal = top[0]?.total ?? 0;

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" />
            Статистика трафика
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Сводка по всем подпискам · обновлено каждое открытие
          </p>
        </div>
        <div className="flex items-center gap-2">
          {updatedAt && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Clock className="size-3" />
              {updatedAt.toLocaleTimeString("ru-RU")}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Activity className="size-4" />} label="Всего трафика" value={fmtBytes(totals.total)} accent />
        <StatCard icon={<ArrowDown className="size-4" />} label="Загружено" value={fmtBytes(totals.down)} hint={totals.total ? `${Math.round((totals.down / totals.total) * 100)}% от общего` : undefined} tone="info" />
        <StatCard icon={<ArrowUp className="size-4" />} label="Отправлено" value={fmtBytes(totals.up)} hint={totals.total ? `${Math.round((totals.up / totals.total) * 100)}% от общего` : undefined} tone="warn" />
        <StatCard icon={<Users className="size-4" />} label="Активных" value={`${totals.active}`} hint={`из ${perSub.length} подписок`} tone="success" />
      </div>

      <Card className="p-5 border-border" style={{ background: "var(--gradient-card)" }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="size-4 text-primary" />
            Динамика за 24 часа
          </div>
          {chartData.length > 0 && (
            <div className="flex items-center gap-4 text-xs">
              <div>
                <div className="text-muted-foreground">За период</div>
                <div className="font-semibold tabular-nums">{fmtBytes(chartData.reduce((s, d) => s + d.bytes, 0))}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Пик/час</div>
                <div className="font-semibold tabular-nums">{fmtBytes(Math.max(...chartData.map((d) => d.bytes)))}</div>
              </div>
            </div>
          )}
        </div>
        {snapshots.length < 2 ? (
          <div className="h-[200px] flex flex-col items-center justify-center text-sm text-muted-foreground gap-2 border border-dashed border-border rounded-lg">
            <Loader2 className="size-5 animate-spin opacity-50" />
            Накапливаем данные…
            <span className="text-xs opacity-70">Снапшоты собираются при каждом обновлении</span>
          </div>
        ) : (
          <div className="h-[240px]">
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

      <Card className="p-5 border-border" style={{ background: "var(--gradient-card)" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Crown className="size-4 text-primary" />
            Топ потребителей
          </div>
          {top.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {top.length} из {perSub.length}
            </span>
          )}
        </div>
        {top.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            {loading ? <Loader2 className="size-4 animate-spin mx-auto" /> : "Пока нет данных"}
          </div>
        ) : (
          <ol className="space-y-3.5">
            {top.map((c, i) => {
              const pct = maxTotal > 0 ? (c.total / maxTotal) * 100 : 0;
              return (
                <li key={c.id}>
                  <div className="flex items-center justify-between mb-1 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`size-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.4)]" : i === 1 ? "bg-primary/20 text-primary" : i === 2 ? "bg-primary/10 text-primary/80" : "bg-secondary text-muted-foreground"}`}>
                        {i + 1}
                      </span>
                      <span className="truncate font-medium">{c.name}</span>
                    </div>
                    <span className="text-xs font-semibold tabular-nums">{fmtBytes(c.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
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

const StatCard = ({
  icon,
  label,
  value,
  hint,
  accent,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  tone?: "info" | "warn" | "success";
}) => {
  const toneChip =
    tone === "info"
      ? "bg-sky-500/15 text-sky-400"
      : tone === "warn"
      ? "bg-amber-500/15 text-amber-400"
      : tone === "success"
      ? "bg-emerald-500/15 text-emerald-400"
      : "bg-primary/15 text-primary";
  return (
    <Card
      className="p-4 border-border relative overflow-hidden group hover:border-primary/40 transition-colors"
      style={accent ? { background: "var(--gradient-hero)" } : { background: "var(--gradient-card)" }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className={`text-[11px] uppercase tracking-wider font-medium ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {label}
        </div>
        <div className={`size-7 rounded-lg flex items-center justify-center ${accent ? "bg-primary-foreground/15 text-primary-foreground" : toneChip}`}>
          {icon}
        </div>
      </div>
      <div className={`text-2xl font-bold tabular-nums leading-tight ${accent ? "text-primary-foreground" : ""}`}>{value}</div>
      {hint && (
        <div className={`text-[11px] mt-1 ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{hint}</div>
      )}
    </Card>
  );
};