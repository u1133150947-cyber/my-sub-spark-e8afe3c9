import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Github, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { APP_VERSION, APP_VERSION_DATE } from "@/version";
import { getAdminToken } from "@/lib/adminAuth";

type VersionInfo = {
  repo: string;
  branch: string;
  local_commit: string | null;
  remote_commit: string | null;
  remote_date: string | null;
  remote_message: string | null;
  remote_error?: string | null;
  update_available: boolean;
};

type UpdateJob = {
  job_id: string;
  state: "queued" | "running" | "done" | "error";
  phase?: string;
  log?: string;
};

export function UpdatePanel() {
  const [log, setLog] = useState<string>("");
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [ghBusy, setGhBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const checkUpdates = async () => {
    setChecking(true);
    try {
      const r = await fetch("/api/version");
      const ct = r.headers.get("content-type") ?? "";
      if (!r.ok || !ct.includes("application/json")) {
        setInfo(null);
        return; // dev/preview: эндпоинта нет, тихо игнорируем
      }
      setInfo(await r.json());
    } catch (e: any) {
      setInfo(null);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkUpdates();
    const t = setInterval(checkUpdates, 60_000);
    return () => clearInterval(t);
  }, []);

  const updateFromGithub = async () => {
    if (!confirm("Установить последнюю версию из GitHub? Сервис перезапустится.")) return;
    const adminToken = getAdminToken();
    if (!adminToken) { toast.error("Нужно войти в админку"); return; }
    setGhBusy(true);
    setLog("⏳ Скачиваю последнюю версию из GitHub…\n");
    try {
      const r = await fetch("/api/update-from-github", {
        method: "POST",
        headers: { "x-admin-token": adminToken },
      });
      const d = await r.json().catch(() => ({} as any));
      setLog(d?.log ?? JSON.stringify(d));
      if (!r.ok || !d?.ok) {
        toast.error("Ошибка обновления из GitHub");
      } else {
        setJobId(d.job_id ?? null);
        toast.success("Обновление запущено в фоне");
      }
    } catch (e: any) {
      toast.error("Сеть: " + (e?.message ?? e));
    } finally {
      setGhBusy(false);
    }
  };

  useEffect(() => {
    if (!jobId) return;
    const adminToken = getAdminToken();
    let stopped = false;
    const poll = async () => {
      if (!adminToken || stopped) return;
      try {
        const r = await fetch(`/api/update/status?job=${encodeURIComponent(jobId)}`, {
          headers: { "x-admin-token": adminToken },
        });
        const d = await r.json().catch(() => null) as UpdateJob | null;
        if (!d) return;
        setLog(d.log ?? "");
        if (d.state === "done") {
          toast.success("Обновление завершено, перезагружаю страницу…");
          stopped = true;
          setGhBusy(false);
          setTimeout(() => window.location.reload(), 2500);
        } else if (d.state === "error") {
          toast.error("Ошибка обновления");
          stopped = true;
          setGhBusy(false);
        }
      } catch {
        // Во время restart сервис может на пару секунд пропасть — продолжаем ждать.
      }
    };
    poll();
    const t = setInterval(poll, 2500);
    return () => { stopped = true; clearInterval(t); };
  }, [jobId]);

  return (
    <Card className="p-6 border-border" style={{ background: "var(--gradient-card)" }}>
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Download className="size-4 text-primary" /> Обновление панели
        </h2>
        <div className="text-xs px-2 py-1 rounded-md bg-secondary border border-border">
          Текущая версия: <span className="font-semibold text-primary">{APP_VERSION}</span>
          <span className="text-muted-foreground"> · {APP_VERSION_DATE}</span>
        </div>
      </div>

      {/* GitHub auto-update */}
      <div className="mb-5 p-4 rounded-lg border border-border bg-secondary/40">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Github className="size-4" /> Обновление из GitHub
          </div>
          <Button size="sm" variant="outline" onClick={checkUpdates} disabled={checking}>
            {checking ? <Loader2 className="size-3 animate-spin mr-1" /> : <RefreshCw className="size-3 mr-1" />}
            Проверить
          </Button>
        </div>

        {info ? (
          <div className="text-xs space-y-1 mb-3">
            <div className="text-muted-foreground">Репозиторий: <code className="text-foreground">{info.repo}</code> · ветка <code className="text-foreground">{info.branch}</code></div>
            <div>На сервере: <code className="text-foreground">{info.local_commit?.slice(0, 7) ?? "—"}</code>
              {!info.local_commit && <span className="text-muted-foreground"> (создай файл <code>/opt/sub-manager/VERSION</code>)</span>}
            </div>
            <div>В GitHub: <code className="text-foreground">{info.remote_commit?.slice(0, 7) ?? "—"}</code>
              {info.remote_date && <span className="text-muted-foreground"> · {new Date(info.remote_date).toLocaleString()}</span>}
            </div>
            {info.remote_message && <div className="text-muted-foreground truncate">«{info.remote_message.split("\n")[0]}»</div>}
            {info.remote_error && (
              <div className="text-destructive break-all">⚠ Ошибка GitHub: {info.remote_error}</div>
            )}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground mb-3">
            Доступно только на развёрнутом сервере (через <code>install.sh</code>). В превью Lovable эндпоинт <code>/api/version</code> отсутствует.
          </div>
        )}

        {info?.update_available ? (
          <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border border-primary/30 mb-3">
            <span className="text-xs text-primary font-medium flex-1">🎉 Доступно обновление!</span>
            <Button size="sm" onClick={updateFromGithub} disabled={ghBusy}
              style={{ background: "var(--gradient-hero)", color: "hsl(var(--primary-foreground))" }}>
              {ghBusy ? <Loader2 className="size-3 animate-spin mr-1" /> : <Download className="size-3 mr-1" />}
              {jobId ? "Обновляется…" : "Обновить сейчас"}
            </Button>
          </div>
        ) : info && info.local_commit && info.remote_commit ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3 text-primary" /> У вас последняя версия
          </div>
        ) : null}
      </div>

      {log && (
        <pre className="text-xs bg-secondary/50 border border-border rounded p-3 max-h-96 overflow-auto whitespace-pre-wrap">
{log}
        </pre>
      )}

      <div className="mt-4 text-[11px] text-muted-foreground space-y-1">
        <div>• Доступно только когда панель развёрнута через <code>install.sh</code> (Deno + systemd).</div>
        <div>• Обновления приходят автоматически из GitHub-репозитория.</div>
      </div>
    </Card>
  );
}