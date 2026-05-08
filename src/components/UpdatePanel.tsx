import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { APP_VERSION, APP_VERSION_DATE } from "@/version";

export function UpdatePanel() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>("");

  const upload = async () => {
    if (!file) return toast.error("Выберите архив (.zip или .tar.gz)");
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".zip") && !lower.endsWith(".tar.gz") && !lower.endsWith(".tgz")) {
      return toast.error("Только .zip или .tar.gz");
    }
    setBusy(true);
    setLog("⏳ Загружаю архив на сервер…\n");
    try {
      const fd = new FormData();
      fd.append("archive", file);
      const res = await fetch("/api/update", { method: "POST", body: fd });
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
      <p className="text-xs text-muted-foreground mb-4">
        Загрузите архив новой версии (<code>.zip</code> или <code>.tar.gz</code>). Сервер распакует, пересоберёт фронт и перезапустится автоматически.
        База данных в <code>data/</code> и настройки сохраняются.
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