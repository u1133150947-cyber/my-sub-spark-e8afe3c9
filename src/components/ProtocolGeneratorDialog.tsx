import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Wand2, KeyRound, Plus } from "lucide-react";

type Template = "vless-reality" | "trojan-tls";

const REALITY_TARGETS = [
  "www.microsoft.com",
  "www.apple.com",
  "www.cloudflare.com",
  "www.lovable.dev",
  "www.amazon.com",
  "www.icloud.com",
];
const FINGERPRINTS = ["chrome", "firefox", "safari", "ios", "android", "edge", "random"];

function shortIdHex(len = 8) {
  const bytes = new Uint8Array(len / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function buildVlessReality(opts: { port: number; remark: string; sni: string; fingerprint: string; privateKey: string; publicKey: string; shortId: string }) {
  const settings = { clients: [], decryption: "none", fallbacks: [] };
  const streamSettings = {
    network: "tcp",
    security: "reality",
    externalProxy: [],
    realitySettings: {
      show: false,
      xver: 0,
      dest: `${opts.sni}:443`,
      serverNames: [opts.sni],
      privateKey: opts.privateKey,
      minClient: "",
      maxClient: "",
      maxTimediff: 0,
      shortIds: [opts.shortId],
      settings: {
        publicKey: opts.publicKey,
        fingerprint: opts.fingerprint,
        serverName: "",
        spiderX: "/",
      },
    },
    tcpSettings: { acceptProxyProtocol: false, header: { type: "none" } },
  };
  const sniffing = { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false, routeOnly: false };
  const allocate = { strategy: "always", refresh: 5, concurrency: 3 };
  return {
    up: 0, down: 0, total: 0,
    remark: opts.remark,
    enable: true,
    expiryTime: 0,
    listen: "",
    port: opts.port,
    protocol: "vless",
    settings,
    streamSettings,
    tag: `inbound-${opts.port}`,
    sniffing,
    allocate,
  };
}

function buildTrojanTls(opts: { port: number; remark: string; sni: string; fingerprint: string; certFile: string; keyFile: string }) {
  const settings = { clients: [], fallbacks: [] };
  const streamSettings = {
    network: "tcp",
    security: "tls",
    externalProxy: [],
    tlsSettings: {
      serverName: opts.sni,
      minVersion: "1.2",
      maxVersion: "1.3",
      cipherSuites: "",
      rejectUnknownSni: false,
      disableSystemRoot: false,
      enableSessionResumption: false,
      certificates: [{ certificateFile: opts.certFile, keyFile: opts.keyFile, ocspStapling: 3600, oneTimeLoading: false, usage: "encipherment" }],
      alpn: ["h2", "http/1.1"],
      settings: { allowInsecure: false, fingerprint: opts.fingerprint },
    },
    tcpSettings: { acceptProxyProtocol: false, header: { type: "none" } },
  };
  const sniffing = { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false, routeOnly: false };
  const allocate = { strategy: "always", refresh: 5, concurrency: 3 };
  return {
    up: 0, down: 0, total: 0,
    remark: opts.remark,
    enable: true,
    expiryTime: 0,
    listen: "",
    port: opts.port,
    protocol: "trojan",
    settings,
    streamSettings,
    tag: `inbound-${opts.port}`,
    sniffing,
    allocate,
  };
}

export function ProtocolGeneratorDialog({
  open,
  onOpenChange,
  panelSlug,
  panelName,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  panelSlug?: string | null;
  panelName?: string;
  onCreated?: () => void;
}) {
  const [template, setTemplate] = useState<Template>("vless-reality");
  const [port, setPort] = useState<number>(443);
  const [remark, setRemark] = useState("");
  const [sni, setSni] = useState(REALITY_TARGETS[0]);
  const [fingerprint, setFingerprint] = useState("chrome");
  const [privateKey, setPrivateKey] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [shortId, setShortId] = useState(shortIdHex(8));
  const [certFile, setCertFile] = useState("/root/cert/fullchain.pem");
  const [keyFile, setKeyFile] = useState("/root/cert/privkey.pem");
  const [jsonOverride, setJsonOverride] = useState("");
  const [editing, setEditing] = useState(false);
  const [genKeys, setGenKeys] = useState(false);
  const [creating, setCreating] = useState(false);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setTemplate("vless-reality");
    setPort(443);
    setRemark("");
    setSni(REALITY_TARGETS[0]);
    setFingerprint("chrome");
    setPrivateKey("");
    setPublicKey("");
    setShortId(shortIdHex(8));
    setEditing(false);
    setJsonOverride("");
  }, [open]);

  const payload = useMemo(() => {
    const r = remark.trim() || (template === "vless-reality" ? `vless-reality-${port}` : `trojan-tls-${port}`);
    if (template === "vless-reality") {
      return buildVlessReality({ port, remark: r, sni, fingerprint, privateKey, publicKey, shortId });
    }
    return buildTrojanTls({ port, remark: r, sni, fingerprint, certFile, keyFile });
  }, [template, port, remark, sni, fingerprint, privateKey, publicKey, shortId, certFile, keyFile]);

  const previewJson = editing ? jsonOverride : JSON.stringify(payload, null, 2);

  const handleGenKeys = async () => {
    if (!panelSlug) return toast.error("Сначала задайте slug панели (проверка подключения)");
    setGenKeys(true);
    try {
      const { data, error } = await supabase.functions.invoke(`panel?action=getRealityKeys&panel=${encodeURIComponent(panelSlug)}`, { method: "POST" });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Не удалось сгенерировать ключи");
      setPrivateKey(data.privateKey);
      setPublicKey(data.publicKey);
      toast.success("Reality x25519 ключи сгенерированы панелью");
    } catch (e: any) {
      toast.error("Ошибка: " + (e?.message ?? e));
    } finally {
      setGenKeys(false);
    }
  };

  const handleCreate = async () => {
    if (!panelSlug) return toast.error("Нет slug панели");
    if (template === "vless-reality" && (!privateKey || !publicKey)) {
      return toast.error("Сначала сгенерируйте Reality ключи");
    }
    if (!Number.isFinite(port) || port < 1 || port > 65535) return toast.error("Некорректный порт");
    let body: unknown = payload;
    if (editing) {
      try { body = JSON.parse(jsonOverride); } catch { return toast.error("JSON невалидный"); }
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("panel?action=createInbound", {
        method: "POST",
        body: { panel: panelSlug, payload: body },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Панель отклонила запрос");
      toast.success(`Inbound создан на ${panelName ?? panelSlug}`);
      onCreated?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Ошибка создания: " + (e?.message ?? e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="size-4 text-primary" /> Генератор протоколов — {panelName ?? panelSlug}
          </DialogTitle>
          <DialogDescription>
            MVP: 2 шаблона. Можно отредактировать JSON перед отправкой. POST уходит на /panel/api/inbounds/add.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Шаблон</Label>
            <div className="flex gap-2 mt-1">
              <Button
                type="button"
                variant={template === "vless-reality" ? "default" : "outline"}
                size="sm"
                onClick={() => setTemplate("vless-reality")}
              >
                VLESS · Reality
              </Button>
              <Button
                type="button"
                variant={template === "trojan-tls" ? "default" : "outline"}
                size="sm"
                onClick={() => setTemplate("trojan-tls")}
              >
                Trojan · TLS
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground">Порт</Label>
              <Input
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Remark (имя в панели)</Label>
              <Input
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder={template === "vless-reality" ? `vless-reality-${port}` : `trojan-tls-${port}`}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">SNI / target</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={sni}
                onChange={(e) => setSni(e.target.value)}
              >
                {REALITY_TARGETS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">uTLS fingerprint</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={fingerprint}
                onChange={(e) => setFingerprint(e.target.value)}
              >
                {FINGERPRINTS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>

          {template === "vless-reality" ? (
            <div className="space-y-2 border rounded-md p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Reality ключи (x25519)</Label>
                <Button type="button" size="sm" variant="outline" onClick={handleGenKeys} disabled={genKeys || !panelSlug}>
                  {genKeys ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <KeyRound className="size-3.5 mr-1" />}
                  Сгенерировать через панель
                </Button>
              </div>
              <Input value={privateKey} onChange={(e) => setPrivateKey(e.target.value)} placeholder="privateKey" />
              <Input value={publicKey} onChange={(e) => setPublicKey(e.target.value)} placeholder="publicKey" />
              <div className="flex gap-2 items-center">
                <Input value={shortId} onChange={(e) => setShortId(e.target.value)} placeholder="shortId (hex)" />
                <Button type="button" size="sm" variant="ghost" onClick={() => setShortId(shortIdHex(8))}>
                  ↻
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 border rounded-md p-3">
              <Label className="text-xs text-muted-foreground">TLS сертификат (пути на сервере панели)</Label>
              <Input value={certFile} onChange={(e) => setCertFile(e.target.value)} placeholder="certificateFile" />
              <Input value={keyFile} onChange={(e) => setKeyFile(e.target.value)} placeholder="keyFile" />
              <p className="text-xs text-muted-foreground">
                Файлы должны существовать на сервере панели. Можно указать пути от Let's Encrypt / acme.sh.
              </p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-muted-foreground">JSON, который уйдёт в /panel/api/inbounds/add</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (!editing) setJsonOverride(JSON.stringify(payload, null, 2));
                  setEditing((v) => !v);
                }}
              >
                {editing ? "Сбросить и закрыть" : "Редактировать"}
              </Button>
            </div>
            <Textarea
              value={previewJson}
              onChange={(e) => editing && setJsonOverride(e.target.value)}
              readOnly={!editing}
              className="font-mono text-xs h-64"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>Отмена</Button>
          <Button onClick={handleCreate} disabled={creating || !panelSlug}>
            {creating ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Plus className="size-4 mr-1" />}
            Создать inbound
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}