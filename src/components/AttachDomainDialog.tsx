import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAdminToken } from "@/lib/adminAuth";

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

export type AttachPanelInfo = {
  id: string;
  name: string;
  panel_url: string;
  host?: string;
  public_host?: string;
};

function parseUrl(u: string) {
  try {
    const x = new URL(u);
    return { host: x.hostname, port: x.port ? Number(x.port) : (x.protocol === "https:" ? 443 : 80), path: x.pathname.replace(/^\/+|\/+$/g, "") };
  } catch { return { host: "", port: 0, path: "" }; }
}

export function AttachDomainDialog({
  panel, open, onOpenChange, onAttached,
}: {
  panel: AttachPanelInfo | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAttached?: () => void;
}) {
  const [host, setHost] = useState("");
  const [sshPort, setSshPort] = useState("22");
  const [sshUser, setSshUser] = useState("root");
  const [auth, setAuth] = useState<"password" | "key">("password");
  const [pwd, setPwd] = useState("");
  const [key, setKey] = useState("");
  const [pass, setPass] = useState("");
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState("");

  useEffect(() => {
    if (!open || !panel) return;
    const u = parseUrl(panel.panel_url);
    setHost(panel.host || panel.public_host || u.host || "");
    setSshPort("22"); setSshUser("root"); setAuth("password");
    setPwd(""); setKey(""); setPass(""); setDomain(""); setEmail(""); setLog("");
  }, [open, panel?.id]);

  const submit = async () => {
    if (!panel) return;
    if (!host.trim()) return toast.error("Укажите IP/хост сервера");
    if (!domain.trim()) return toast.error("Укажите домен");
    if (auth === "password" && !pwd) return toast.error("SSH-пароль обязателен");
    if (auth === "key" && !key.trim()) return toast.error("Приватный ключ обязателен");

    const u = parseUrl(panel.panel_url);
    setRunning(true); setLog("→ запуск выпуска сертификата...\n");
    try {
      const token = getAdminToken();
      const res = await fetch(`${apiBase()}/api/attach-domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
        body: JSON.stringify({
          host: host.trim(),
          ssh_port: Number(sshPort) || 22,
          ssh_user: sshUser.trim() || "root",
          ssh_auth: auth,
          ssh_password: auth === "password" ? pwd : undefined,
          ssh_private_key: auth === "key" ? key : undefined,
          ssh_passphrase: pass || undefined,
          domain: domain.trim(),
          letsencrypt_email: email.trim() || undefined,
          panel_port: u.port,
          panel_path: u.path,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      setLog((data.log ?? "") + (data.error ? `\n\n✗ ${data.error}` : ""));
      if (!res.ok || !data.ok) {
        toast.error(data?.error ?? `HTTP ${res.status}`);
        return;
      }
      const newUrl = data.panel_url || `https://${domain.trim()}:${u.port}${u.path ? "/" + u.path : ""}`;
      const { error } = await supabase.from("panels").update({
        host: domain.trim(),
        public_host: domain.trim(),
        panel_url: newUrl,
        status: "ok",
        status_message: "",
        last_checked_at: new Date().toISOString(),
      }).eq("id", panel.id);
      if (error) toast.error("Сертификат выпущен, но обновить запись не удалось: " + error.message);
      else { toast.success("Домен прикреплён, URL обновлён"); onAttached?.(); onOpenChange(false); }
    } catch (e: any) {
      setLog((l) => l + `\n✗ ${e?.message ?? e}`);
      toast.error("Ошибка: " + (e?.message ?? e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!running) onOpenChange(o); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock className="size-4" /> Прикрепить домен — {panel?.name}</DialogTitle>
          <DialogDescription>
            Подключусь по SSH, выпущу Let's Encrypt сертификат для домена и привяжу его к 3X-UI. URL панели обновится автоматически.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">IP сервера (для SSH)</Label>
              <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="1.2.3.4" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">SSH порт</Label>
              <Input value={sshPort} onChange={(e) => setSshPort(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">SSH юзер</Label>
              <Input value={sshUser} onChange={(e) => setSshUser(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Авторизация</Label>
              <Tabs value={auth} onValueChange={(v) => setAuth(v as any)}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="password">Пароль</TabsTrigger>
                  <TabsTrigger value="key">Ключ</TabsTrigger>
                </TabsList>
                <TabsContent value="password" className="mt-2">
                  <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="SSH пароль" />
                </TabsContent>
                <TabsContent value="key" className="mt-2 space-y-2">
                  <Textarea value={key} onChange={(e) => setKey(e.target.value)} className="font-mono text-xs h-28"
                    placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----"} />
                  <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Passphrase ключа (если есть)" />
                </TabsContent>
              </Tabs>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Домен</Label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="panel.example.com" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email Let's Encrypt (опц.)</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
            Убедитесь, что A-запись домена указывает на IP сервера, а порт 80 свободен на момент выпуска сертификата.
          </div>
          {log && (
            <div className="rounded-md border bg-muted/30 p-3">
              <pre className="text-xs whitespace-pre-wrap break-words max-h-72 overflow-y-auto font-mono">{log}</pre>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>Закрыть</Button>
          <Button onClick={submit} disabled={running}>
            {running ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Lock className="size-4 mr-1" />}
            {running ? "Выпускаю…" : "Выпустить и прикрепить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
