import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Download, Github, RefreshCw, CheckCircle2 } from "lucide-react";
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

export function UpdatePanel() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>("");
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [ghBusy, setGhBusy] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testingInbounds, setTestingInbounds] = useState(false);
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
        toast.success("Обновлено до " + (d.commit?.slice(0, 7) ?? "latest") + "! Перезапуск…");
        setTimeout(() => window.location.reload(), 4000);
      }
    } catch (e: any) {
      toast.error("Сеть: " + (e?.message ?? e));
    } finally {
      setGhBusy(false);
    }
  };

  const runTests = async () => {
    if (!confirm("Создать 10 тестовых аккаунтов прямо сейчас?")) return;
    const adminToken = getAdminToken();
    if (!adminToken) { toast.error("Нужно войти в админку"); return; }
    setTesting(true);
    setLog("⏳ Запускаю создание тестовых аккаунтов…\n");
    try {
      const r = await fetch("/api/test-accounts", {
        method: "POST",
        headers: { "x-admin-token": adminToken },
      });
      const d = await r.json().catch(() => ({} as any));
      setLog(d?.log ? d.log.join("\n") : JSON.stringify(d));
      if (!r.ok || !d?.ok) {
        toast.error("Ошибка при создании: " + (d?.error ?? ""));
      } else {
        toast.success(`Успешно добавлено ${d.successCount} подключений!`);
      }
    } catch (e: any) {
      toast.error("Сеть: " + (e?.message ?? e));
    } finally {
      setTesting(false);
    }
  };

  const runTestInbounds = async () => {
    if (!confirm("Создать 25 тестовых inbounds на всех панелях?")) return;
    const adminToken = getAdminToken();
    if (!adminToken) { toast.error("Нужно войти в админку"); return; }
    setTestingInbounds(true);
    setLog("⏳ Запускаю создание тестовых inbounds…\n");
    try {
      const r = await fetch("/api/test-inbounds", {
        method: "POST",
        headers: { "x-admin-token": adminToken },
      });
      const d = await r.json().catch(() => ({} as any));
      setLog(d?.log ? d.log.join("\n") : JSON.stringify(d));
      if (!r.ok || !d?.ok) {
        toast.error("Ошибка при создании: " + (d?.error ?? ""));
      } else {
        toast.success(`Успешно создано ${d.successCount} inbounds!`);
      }
    } catch (e: any) {
      toast.error("Сеть: " + (e?.message ?? e));
    } finally {
      setTestingInbounds(false);
    }
  };

  const upload = async () => {
    if (!file) return toast.error("Выберите архив (.zip или .tar.gz)");
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".zip") && !lower.endsWith(".tar.gz") && !lower.endsWith(".tgz")) {
      return toast.error("Только .zip или .tar.gz");
    }
    const adminToken = getAdminToken();
    if (!adminToken) { toast.error("Нужно войти в админку"); return; }
    setBusy(true);
    setLog("⏳ Загружаю архив на сервер…\n");
    try {
      const fd = new FormData();
      fd.append("archive", file);
      const res = await fetch("/api/update", {
        method: "POST",
        body: fd,
        headers: { "x-admin-token": adminToken },
      });
      const data = await res.json().catch(() => ({} as any));
      setLog(data?.log ?? JSON.stringify(data));
      if (!res.ok || !data?.ok) {
        toast.error("Ошибка обновления");
      } else {
        toast.success("Обновлено! Сервис перезапускается…");
        setTimeout(() => window.location.reload(), 4000);
      }
    } catch (e: any) {
      toast.error("Сеть: " + (e?.message ?? e));
      setLog((p) => p + "\n" + (e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

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
              Обновить сейчас
            </Button>
          </div>
        ) : info && info.local_commit && info.remote_commit ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3 text-primary" /> У вас последняя версия
          </div>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        <Button onClick={runTests} disabled={testing || testingInbounds || busy || ghBusy} className="w-full mb-2" variant="outline" size="sm">
          {testing ? <Loader2 className="size-4 animate-spin mr-2" /> : <CheckCircle2 className="size-4 mr-2 text-primary" />}
          Создать 10 тестовых аккаунтов (проверка работы панелей)
        </Button>
        <Button onClick={runTestInbounds} disabled={testing || testingInbounds || busy || ghBusy} className="w-full mb-4" variant="outline" size="sm">
          {testingInbounds ? <Loader2 className="size-4 animate-spin mr-2" /> : <CheckCircle2 className="size-4 mr-2 text-primary" />}
          Создать 25 inbounds (проверка протоколов)
        </Button>
        <br/>
        Или загрузите архив вручную (<code>.zip</code> / <code>.tar.gz</code>). База в <code>data/</code> сохраняется.
      </p>

      <div className="grid gap-3 md:grid-cols-[1fr_auto] items-end mb-4">
        <div>
          <Label className="text-xs text-muted-foreground">Архив обновления</Label>
          <Input type="file" accept=".zip,.tar.gz,.tgz" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {file && <div className="text-xs text-muted-foreground mt-1">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</div>}
        </div>
        <Button onClick={upload} disabled={busy || !file}
          style={{ background: "var(--gradient-hero)", color: "hsl(var(--primary-foreground))" }}>
          {busy ? <Loader2 className="size-4 animate-spin mr-1" /> : <Upload className="size-4 mr-1" />}
          Установить
        </Button>
      </div>

      {log && (
        <pre className="text-xs bg-secondary/50 border border-border rounded p-3 max-h-96 overflow-auto whitespace-pre-wrap">
{log}
        </pre>
      )}

      <div className="mt-4 text-[11px] text-muted-foreground space-y-1">
        <div>• Доступно только когда панель развёрнута через <code>install.sh</code> (Deno + systemd).</div>
        <div>• Архив должен содержать корень проекта (<code>package.json</code>, <code>src/</code>, <code>server/</code>…). Допустима одна вложенная папка.</div>
        <div>• Caddy должен разрешать большой body — в <code>install.sh</code> уже настроено <code>max_size 200MB</code>.</div>
      </div>
    </Card>
  );
}