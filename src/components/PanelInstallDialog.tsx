import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";
import { getAdminToken } from "@/lib/adminAuth";

function rndPort() { return 20000 + Math.floor(Math.random() * 40000); }
function rndStr(n: number) {
  const a = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: n }, () => a[Math.floor(Math.random() * a.length)]).join("");
}

const apiBase = () => {
  const raw = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "";
  if (!raw) return "";
  try {
    const u = new URL(raw);
    return u.hostname.endsWith(".supabase.co") ? "" : raw.replace(/\/+$/, "");
  } catch {
    return raw.replace(/\/+$/, "");
  }
};

const empty = () => ({
  host: "",
  ssh_port: "22",
  ssh_user: "root",
  ssh_auth: "password" as "password" | "key",
  ssh_password: "",
  ssh_private_key: "",
  ssh_passphrase: "",
  mode: "ip" as "ip" | "domain",
  domain: "",
  letsencrypt_email: "",
  panel_port: String(rndPort()),
  panel_path: rndStr(10),
  panel_username: "admin",
  panel_password: rndStr(14),
  country: "",
  name: "",
  save: true,
});

export function PanelInstallDialog({
  open, onOpenChange, onInstalled,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onInstalled?: () => void;
}) {
  const [f, setF] = useState(empty());
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string>("");
  const [result, setResult] = useState<{ panel_url?: string; saved?: { slug: string } } | null>(null);

  const upd = <K extends keyof ReturnType<typeof empty>>(k: K, v: any) =>
    setF((s) => ({ ...s, [k]: v }));

  const reset = () => { setF(empty()); setLog(""); setResult(null); };

  const submit = async () => {
    if (!f.host.trim()) return toast.error("Укажите IP или домен сервера");
    if (f.ssh_auth === "password" && !f.ssh_password) return toast.error("SSH-пароль обязателен");
    if (f.ssh_auth === "key" && !f.ssh_private_key.trim()) return toast.error("Приватный ключ обязателен");
    if (f.mode === "domain" && !f.domain.trim()) return toast.error("Укажите домен");

    setRunning(true);
    setLog("→ запуск установки...\n");
    setResult(null);
    try {
      const token = getAdminToken();
      const base = apiBase();
      const url = `${base}/api/install-panel`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-admin-token": token } : {}),
        },
        body: JSON.stringify({
          host: f.host.trim(),
          ssh_port: Number(f.ssh_port) || 22,
          ssh_user: f.ssh_user.trim() || "root",
          ssh_auth: f.ssh_auth,
          ssh_password: f.ssh_auth === "password" ? f.ssh_password : undefined,
          ssh_private_key: f.ssh_auth === "key" ? f.ssh_private_key : undefined,
          ssh_passphrase: f.ssh_passphrase || undefined,
          mode: f.mode,
          domain: f.mode === "domain" ? f.domain.trim() : undefined,
          letsencrypt_email: f.mode === "domain" && f.letsencrypt_email ? f.letsencrypt_email.trim() : undefined,
          panel_port: Number(f.panel_port),
          panel_path: f.panel_path.trim(),
          panel_username: f.panel_username.trim(),
          panel_password: f.panel_password,
          save: f.save,
          name: f.name.trim() || undefined,
          country: f.country.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      setLog((data.log ?? "") + (data.error ? `\n\n✗ ${data.error}` : ""));
      if (!res.ok || !data.ok) {
        toast.error(data?.error ?? `HTTP ${res.status}`);
      } else {
        setResult({ panel_url: data.panel_url, saved: data.saved });
        toast.success(f.save ? "Панель установлена и добавлена в список" : "Панель установлена");
        onInstalled?.();
      }
    } catch (e: any) {
      setLog((l) => l + `\n✗ ${e?.message ?? e}`);
      toast.error("Ошибка: " + (e?.message ?? e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !running) { onOpenChange(o); setTimeout(reset, 300); } else onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Rocket className="size-4" /> Авто-установка 3X-UI</DialogTitle>
          <DialogDescription>
            Подключусь по SSH, установлю последнюю 3X-UI (скрипт MHSanaei), задам порт/логин/пароль и при желании добавлю панель в список.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* SERVER */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">IP или домен сервера</Label>
              <Input value={f.host} onChange={(e) => upd("host", e.target.value)} placeholder="1.2.3.4 или srv.example.com" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">SSH порт</Label>
              <Input value={f.ssh_port} onChange={(e) => upd("ssh_port", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">SSH юзер</Label>
              <Input value={f.ssh_user} onChange={(e) => upd("ssh_user", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Способ авторизации</Label>
              <Tabs value={f.ssh_auth} onValueChange={(v) => upd("ssh_auth", v)}>
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="password">Пароль</TabsTrigger>
                  <TabsTrigger value="key">Приватный ключ</TabsTrigger>
                </TabsList>
                <TabsContent value="password" className="mt-2">
                  <Input type="password" value={f.ssh_password} onChange={(e) => upd("ssh_password", e.target.value)} placeholder="SSH пароль" />
                </TabsContent>
                <TabsContent value="key" className="mt-2 space-y-2">
                  <Textarea
                    value={f.ssh_private_key}
                    onChange={(e) => upd("ssh_private_key", e.target.value)}
                    placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----"}
                    className="font-mono text-xs h-28"
                  />
                  <Input type="password" value={f.ssh_passphrase} onChange={(e) => upd("ssh_passphrase", e.target.value)} placeholder="Passphrase ключа (если есть)" />
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* MODE */}
          <div>
            <Label className="text-xs text-muted-foreground">Режим установки</Label>
            <Tabs value={f.mode} onValueChange={(v) => upd("mode", v)}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="ip">Чистый IP (self-signed)</TabsTrigger>
                <TabsTrigger value="domain">Домен (Let's Encrypt)</TabsTrigger>
              </TabsList>
              <TabsContent value="domain" className="mt-2 grid md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Домен</Label>
                  <Input value={f.domain} onChange={(e) => upd("domain", e.target.value)} placeholder="panel.example.com" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email для Let's Encrypt (опц.)</Label>
                  <Input value={f.letsencrypt_email} onChange={(e) => upd("letsencrypt_email", e.target.value)} placeholder="admin@example.com" />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* PANEL CREDS */}
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Порт панели</Label>
              <Input value={f.panel_port} onChange={(e) => upd("panel_port", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Web base path (опц.)</Label>
              <Input value={f.panel_path} onChange={(e) => upd("panel_path", e.target.value)} placeholder="скрытый путь, напр. abc123" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Логин админа</Label>
              <Input value={f.panel_username} onChange={(e) => upd("panel_username", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Пароль админа</Label>
              <Input type="text" value={f.panel_password} onChange={(e) => upd("panel_password", e.target.value)} className="font-mono" />
            </div>
          </div>

          {/* SAVE TO PANELS */}
          <div className="grid md:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 text-sm md:col-span-3">
              <input type="checkbox" checked={f.save} onChange={(e) => upd("save", e.target.checked)} />
              Сразу добавить в список панелей
            </label>
            {f.save && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Страна (код, опц.)</Label>
                  <Input value={f.country} onChange={(e) => upd("country", e.target.value.toUpperCase())} placeholder="DE" maxLength={2} />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Название (опц.)</Label>
                  <Input value={f.name} onChange={(e) => upd("name", e.target.value)} placeholder={f.mode === "domain" ? f.domain : f.host} />
                </div>
              </>
            )}
          </div>

          {(log || result) && (
            <div className="rounded-md border bg-muted/30 p-3">
              {result?.panel_url && (
                <div className="text-sm mb-2">
                  <span className="text-muted-foreground">URL панели: </span>
                  <a className="text-primary underline break-all" href={result.panel_url} target="_blank" rel="noreferrer">{result.panel_url}</a>
                </div>
              )}
              <pre className="text-xs whitespace-pre-wrap break-words max-h-72 overflow-y-auto font-mono">{log}</pre>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>Закрыть</Button>
          <Button onClick={submit} disabled={running}>
            {running ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Rocket className="size-4 mr-1" />}
            {running ? "Устанавливаю…" : "Установить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}