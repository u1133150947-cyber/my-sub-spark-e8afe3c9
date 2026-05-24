import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, RefreshCw, Copy, Download, Trash, Loader2, Search } from "lucide-react";
import type { AppLog, ServerLog } from "@/modules/shared/types";
import { LS_KEY } from "@/modules/shared/constants";
import { APP_LOGS, pushLog } from "@/modules/shared/utils";

interface Props {
  appLogs: AppLog[];
  setAppLogs: (logs: AppLog[]) => void;
  active: boolean;
}

export function LogsTab({ appLogs, setAppLogs, active }: Props) {
  const [serverLogs, setServerLogs] = useState<ServerLog[]>([]);
  const [logSource, setLogSource] = useState<"client" | "server" | "all">("all");
  const [logLevel, setLogLevel] = useState<"all" | "error" | "warn" | "info">("all");
  const [logSearch, setLogSearch] = useState("");
  const [logGroup, setLogGroup] = useState(true);
  const [logHours, setLogHours] = useState(24);
  const [serverLogsLoading, setServerLogsLoading] = useState(false);

  const loadServerLogs = async () => {
    setServerLogsLoading(true);
    try {
      const params = new URLSearchParams({ hours: String(logHours), limit: "500" });
      if (logLevel !== "all") params.set("level", logLevel);
      if (logSearch.trim()) params.set("q", logSearch.trim());
      const { data, error } = await supabase.functions.invoke(`panel?action=auditLog&${params.toString()}`, { method: "GET" });
      if (error) throw error;
      setServerLogs(((data as any)?.logs ?? []) as ServerLog[]);
    } catch (e: any) {
      pushLog("error", "auditLog", e?.message ?? String(e));
    } finally {
      setServerLogsLoading(false);
    }
  };

  useEffect(() => {
    if (active) loadServerLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const clientItems = appLogs.map((l) => ({
    ts: l.ts, level: l.level, source: `client:${l.source}`,
    message: l.message, request_id: null as string | null, action: l.source,
  }));
  const serverItems = serverLogs.map((s) => ({
    ts: new Date(s.ts).getTime(),
    level: (s.level as any) || "info",
    source: `server:${s.action}${s.panel_slug ? `@${s.panel_slug}` : ""}`,
    message: [s.error, s.duration_ms != null ? `(${s.duration_ms}ms)` : "", s.meta && Object.keys(s.meta).length ? JSON.stringify(s.meta) : ""].filter(Boolean).join(" "),
    request_id: s.request_id, action: s.action,
  }));
  const merged = [
    ...(logSource === "server" ? [] : clientItems),
    ...(logSource === "client" ? [] : serverItems),
  ]
    .filter((l) => logLevel === "all" || l.level === logLevel)
    .filter((l) => !logSearch.trim() || (l.message + " " + l.source).toLowerCase().includes(logSearch.toLowerCase().trim()))
    .sort((a, b) => b.ts - a.ts);

  const grouped: { key: string; first: typeof merged[0]; count: number; ts: number }[] = [];
  if (logGroup) {
    const map = new Map<string, { first: typeof merged[0]; count: number; ts: number }>();
    for (const m of merged) {
      const key = `${m.level}|${m.source}|${m.message.slice(0, 200)}`;
      const ex = map.get(key);
      if (ex) { ex.count++; if (m.ts > ex.ts) ex.ts = m.ts; }
      else map.set(key, { first: m, count: 1, ts: m.ts });
    }
    for (const [k, v] of map) grouped.push({ key: k, ...v });
    grouped.sort((a, b) => b.ts - a.ts);
  }

  const display = logGroup ? grouped : merged.map((m, i) => ({ key: String(i), first: m, count: 1, ts: m.ts }));
  const exportText = merged.map((l) => `[${new Date(l.ts).toISOString()}] ${l.level.toUpperCase()} ${l.source}${l.request_id ? ` rid=${l.request_id.slice(0,8)}` : ""}: ${l.message}`).join("\n");
  const counts = {
    error: merged.filter((m) => m.level === "error").length,
    warn: merged.filter((m) => m.level === "warn").length,
    info: merged.filter((m) => m.level === "info").length,
  };

  return (
    <Card className="p-5 border-border" style={{ background: "var(--gradient-card)" }}>
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="size-5 text-primary" /> Логи
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {display.length}{logGroup ? ` групп / ${merged.length} записей` : " записей"}
            {(counts.error > 0 || counts.warn > 0) && (
              <>
                {" · "}
                {counts.error > 0 && <span className="text-destructive font-medium">{counts.error} ошибок</span>}
                {counts.error > 0 && counts.warn > 0 && " · "}
                {counts.warn > 0 && <span className="text-yellow-500 font-medium">{counts.warn} предупреждений</span>}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Button variant="outline" size="sm" onClick={loadServerLogs} disabled={serverLogsLoading}>
            {serverLogsLoading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <RefreshCw className="size-3.5 mr-1" />} Обновить
          </Button>
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(exportText || "(пусто)"); toast.success("Логи скопированы"); }}>
            <Copy className="size-3.5 mr-1" /> Копировать
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            const blob = new Blob([JSON.stringify(merged, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `app-logs-${new Date().toISOString().slice(0,19)}.json`;
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
          }}>
            <Download className="size-3.5 mr-1" /> JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => { APP_LOGS.length = 0; localStorage.removeItem(LS_KEY); setAppLogs([]); setServerLogs([]); }}>
            <Trash className="size-3.5 mr-1" /> Очистить
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 mb-3 p-3 rounded-lg bg-background/40 border border-border">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex p-0.5 rounded-md bg-secondary text-xs">
            {(["all","client","server"] as const).map((s) => (
              <button key={s} onClick={() => setLogSource(s)}
                className={`px-2.5 py-1 rounded transition-colors ${logSource === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {s === "all" ? "Все" : s === "client" ? "Клиент" : "Сервер"}
              </button>
            ))}
          </div>
          <div className="inline-flex p-0.5 rounded-md bg-secondary text-xs">
            {([
              { v: "all", label: "Все", cls: "" },
              { v: "error", label: `Errors${counts.error ? ` ${counts.error}` : ""}`, cls: "text-destructive" },
              { v: "warn", label: `Warn${counts.warn ? ` ${counts.warn}` : ""}`, cls: "text-yellow-500" },
              { v: "info", label: "Info", cls: "" },
            ] as const).map((s) => (
              <button key={s.v} onClick={() => setLogLevel(s.v as any)}
                className={`px-2.5 py-1 rounded transition-colors ${logLevel === s.v ? `bg-background shadow-sm ${s.cls || "text-foreground"}` : "text-muted-foreground hover:text-foreground"}`}>
                {s.label}
              </button>
            ))}
          </div>
          <select className="bg-background border border-border rounded px-2 py-1 text-xs h-7" value={logHours} onChange={(e) => setLogHours(Number(e.target.value))}>
            <option value={1}>1 час</option>
            <option value={24}>24 часа</option>
            <option value={168}>7 дней</option>
            <option value={720}>30 дней</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer ml-auto">
            <input type="checkbox" className="accent-primary" checked={logGroup} onChange={(e) => setLogGroup(e.target.checked)} />
            Группировать
          </label>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input placeholder="Поиск по сообщениям и источникам…" value={logSearch} onChange={(e) => setLogSearch(e.target.value)} className="text-xs h-8 pl-8" />
        </div>
      </div>

      {display.length === 0 ? (
        <div className="text-sm text-muted-foreground py-12 text-center border border-dashed border-border rounded-lg">
          <FileText className="size-6 mx-auto mb-2 opacity-40" />
          Записей нет
          <div className="text-xs mt-1 opacity-70">Нажмите «Обновить» чтобы подгрузить серверные логи</div>
        </div>
      ) : (
        <div className="space-y-1 max-h-[65vh] overflow-auto font-mono text-xs pr-1">
          {display.map((g) => {
            const l = g.first;
            const isErr = l.level === "error";
            const isWarn = l.level === "warn";
            const stripe = isErr ? "border-l-destructive" : isWarn ? "border-l-yellow-500" : "border-l-primary/40";
            const bg = isErr ? "bg-destructive/5 hover:bg-destructive/10" : isWarn ? "bg-yellow-500/5 hover:bg-yellow-500/10" : "bg-secondary/30 hover:bg-secondary/50";
            const levelBadge = isErr ? "bg-destructive/20 text-destructive" : isWarn ? "bg-yellow-500/20 text-yellow-500" : "bg-primary/15 text-primary/80";
            return (
              <div key={g.key} className={`px-3 py-1.5 rounded-md border-l-2 ${stripe} ${bg} transition-colors`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="opacity-60 shrink-0 tabular-nums">{new Date(g.ts).toLocaleTimeString()}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${levelBadge}`}>{l.level}</span>
                  <span className="opacity-70 truncate">{l.source}</span>
                  {g.count > 1 && <span className="px-1.5 py-0.5 rounded bg-foreground/10 text-foreground/80 text-[10px]">×{g.count}</span>}
                  {l.request_id && <span className="opacity-50 text-[10px] ml-auto">rid:{l.request_id.slice(0, 8)}</span>}
                </div>
                {l.message && <pre className="whitespace-pre-wrap break-all mt-1 text-foreground/80 leading-relaxed">{l.message}</pre>}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}