import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Server,
  Rocket,
  Search,
  KeyRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

type Stage = "idle" | "detecting" | "installing" | "saving" | "success" | "error";

type DetectResp = {
  ok: boolean;
  installed?: boolean;
  ssl?: boolean;
  port?: number;
  path?: string;
  raw?: string;
  error?: string;
};

type InstallResp = {
  ok: boolean;
  panel_url?: string;
  log?: string;
  error?: string;
  save_error?: string;
  saved?: { id: string; slug: string };
};

const COUNTRIES = [
  "RU", "CZ", "DE", "NL", "FR", "GB", "US", "JP", "SG", "TR",
  "FI", "SE", "PL", "LV", "LT", "EE", "KZ", "CH", "AT", "ES",
] as const;

const randomPath = () =>
  "p" + Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
const strongPass = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%"[b % 60])
    .join("");

export default function PanelInstallPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState("");
  const [logTail, setLogTail] = useState("");
  const [installed, setInstalled] = useState<DetectResp | null>(null);

  const [form, setForm] = useState({
    host: "",
    ssh_port: 22,
    ssh_user: "root",
    ssh_password: "",
    mode: "ip" as "ip" | "domain",
    domain: "",
    panel_port: 2053,
    panel_path: randomPath(),
    panel_username: "admin",
    panel_password: strongPass(),
    name: "",
    country: "",
    save: true,
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const busy = stage === "detecting" || stage === "installing" || stage === "saving";

  const buildBody = () => ({
    host: form.host.trim(),
    ssh_port: Number(form.ssh_port) || 22,
    ssh_user: form.ssh_user.trim() || "root",
    ssh_auth: "password",
    ssh_password: form.ssh_password,
  });

  const detect = async () => {
    if (!form.host.trim() || !form.ssh_password) {
      toast.error("Укажи IP и SSH пароль");
      return;
    }
    setStage("detecting");
    setMessage("Подключаюсь по SSH и проверяю наличие 3X-UI…");
    setLogTail("");
    setInstalled(null);
    try {
      const r = await fetch("/api/detect-panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });
      const data: DetectResp = await r.json();
      if (!data.ok) {
        setStage("error");
        setMessage(data.error || "Не удалось подключиться по SSH");
        toast.error(data.error || "SSH ошибка");
        return;
      }
      setInstalled(data);
      if (data.installed) {
        setStage("idle");
        setMessage(
          `На сервере уже стоит 3X-UI (порт ${data.port ?? "?"}, путь /${data.path ?? ""}). Установка обновит логин/пароль/порт/путь по форме.`
        );
        if (data.port) set("panel_port", data.port);
        if (data.path) set("panel_path", data.path);
      } else {
        setStage("idle");
        setMessage("3X-UI не найден — нажми «Установить и подключить».");
      }
    } catch (e: any) {
      setStage("error");
      setMessage(String(e?.message ?? e));
      toast.error("Ошибка детекта");
    }
  };

  const install = async () => {
    if (!form.host.trim() || !form.ssh_password) {
      toast.error("Укажи IP и SSH пароль");
      return;
    }
    if (form.mode === "domain" && !form.domain.trim()) {
      toast.error("Укажи домен для режима «Домен + Let's Encrypt»");
      return;
    }
    if (form.panel_password.length < 6) {
      toast.error("Пароль панели минимум 6 символов");
      return;
    }
    setStage("installing");
    setMessage("Устанавливаю 3X-UI и применяю настройки… (5–10 минут)");
    setLogTail("");
    try {
      const body = {
        ...buildBody(),
        mode: form.mode,
        domain: form.mode === "domain" ? form.domain.trim() : undefined,
        panel_port: Number(form.panel_port),
        panel_path: form.panel_path.trim(),
        panel_username: form.panel_username.trim(),
        panel_password: form.panel_password,
        save: form.save,
        name: form.name.trim() || (form.mode === "domain" ? form.domain : form.host),
        country: form.country || undefined,
      };
      const r = await fetch("/api/install-panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: InstallResp = await r.json();
      const tail = (data.log || "").split("\n").slice(-25).join("\n");
      setLogTail(tail);
      if (!r.ok || !data.ok) {
        setStage("error");
        setMessage(data.error || `Установка не удалась (HTTP ${r.status})`);
        toast.error(data.error || "Ошибка установки");
        return;
      }
      if (data.save_error) {
        setStage("error");
        setMessage(`Панель установлена (${data.panel_url}), но не сохранилась в БД: ${data.save_error}`);
        toast.error("Установлено, но не сохранено в БД");
        return;
      }
      setStage("success");
      setMessage(`Готово! Панель доступна: ${data.panel_url}`);
      toast.success("Панель установлена и добавлена");
    } catch (e: any) {
      setStage("error");
      setMessage(String(e?.message ?? e));
      toast.error("Ошибка установки");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <Card className="p-6 border-border" style={{ background: "var(--gradient-card)" }}>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <Server className="size-4 text-primary" /> Автоустановка 3X-UI на сервер
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          SSH-подключение → проверка → если нет, ставим официальный установщик MHSanaei → применяем логин/пароль/порт/путь → сохраняем в список панелей.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label className="text-xs text-muted-foreground">IP сервера *</Label>
            <Input
              value={form.host}
              onChange={(e) => set("host", e.target.value)}
              placeholder="185.87.148.138"
              disabled={busy}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">SSH порт</Label>
              <Input
                type="number"
                value={form.ssh_port}
                onChange={(e) => set("ssh_port", Number(e.target.value) || 22)}
                disabled={busy}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">SSH user</Label>
              <Input
                value={form.ssh_user}
                onChange={(e) => set("ssh_user", e.target.value)}
                disabled={busy}
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs text-muted-foreground">SSH password *</Label>
            <Input
              type="password"
              value={form.ssh_password}
              onChange={(e) => set("ssh_password", e.target.value)}
              placeholder="используется один раз, не сохраняется"
              disabled={busy}
            />
          </div>

          <div className="md:col-span-2 border-t border-border pt-4">
            <Label className="text-xs text-muted-foreground">Режим панели</Label>
            <div className="flex gap-2 mt-1">
              <Button
                type="button"
                size="sm"
                variant={form.mode === "ip" ? "default" : "outline"}
                onClick={() => set("mode", "ip")}
                disabled={busy}
              >
                IP + self-signed
              </Button>
              <Button
                type="button"
                size="sm"
                variant={form.mode === "domain" ? "default" : "outline"}
                onClick={() => set("mode", "domain")}
                disabled={busy}
              >
                Домен + Let's Encrypt
              </Button>
            </div>
          </div>

          {form.mode === "domain" && (
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground">Домен (A-запись → IP сервера)</Label>
              <Input
                value={form.domain}
                onChange={(e) => set("domain", e.target.value)}
                placeholder="panel.example.com"
                disabled={busy}
              />
            </div>
          )}

          <div>
            <Label className="text-xs text-muted-foreground">Порт панели</Label>
            <Input
              type="number"
              value={form.panel_port}
              onChange={(e) => set("panel_port", Number(e.target.value) || 2053)}
              disabled={busy}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Web base path (без слешей)</Label>
            <Input
              value={form.panel_path}
              onChange={(e) => set("panel_path", e.target.value)}
              disabled={busy}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Логин панели</Label>
            <Input
              value={form.panel_username}
              onChange={(e) => set("panel_username", e.target.value)}
              disabled={busy}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Пароль панели</Label>
            <div className="flex gap-2">
              <Input
                value={form.panel_password}
                onChange={(e) => set("panel_password", e.target.value)}
                disabled={busy}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => set("panel_password", strongPass())}
                disabled={busy}
                title="Сгенерировать"
              >
                <KeyRound className="size-4" />
              </Button>
            </div>
          </div>

          <div className="md:col-span-2 border-t border-border pt-4 grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground">Имя в админке</Label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="auto → host/домен"
                disabled={busy}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Страна (ISO)</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
                disabled={busy}
              >
                <option value="">—</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-5">
          <Button type="button" variant="outline" onClick={detect} disabled={busy}>
            {stage === "detecting" ? <Loader2 className="size-4 animate-spin mr-2" /> : <Search className="size-4 mr-2" />}
            Проверить сервер
          </Button>
          <Button
            type="button"
            onClick={install}
            disabled={busy}
            style={{ background: "var(--gradient-hero)", color: "hsl(var(--primary-foreground))" }}
          >
            {stage === "installing" ? <Loader2 className="size-4 animate-spin mr-2" /> : <Rocket className="size-4 mr-2" />}
            {installed?.installed ? "Переприменить настройки" : "Установить и подключить"}
          </Button>
          {stage === "success" && (
            <Button type="button" variant="secondary" onClick={() => navigate("/panels")}>
              К списку панелей →
            </Button>
          )}
        </div>

        {message && (
          <div
            className={
              "mt-4 rounded-md border p-3 text-sm flex gap-2 " +
              (stage === "success"
                ? "border-green-500/30 bg-green-500/10 text-green-500"
                : stage === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-border bg-muted/40 text-foreground")
            }
          >
            {stage === "success" ? (
              <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
            ) : stage === "error" ? (
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
            ) : busy ? (
              <Loader2 className="size-4 mt-0.5 shrink-0 animate-spin" />
            ) : (
              <Search className="size-4 mt-0.5 shrink-0" />
            )}
            <div className="whitespace-pre-wrap break-words flex-1">{message}</div>
          </div>
        )}

        {logTail && (
          <pre className="mt-3 max-h-72 overflow-auto rounded-md border border-border bg-background/60 p-3 text-xs leading-relaxed">
            {logTail}
          </pre>
        )}
      </Card>

      <Card className="p-4 border-border text-xs text-muted-foreground space-y-1">
        <div>• Установщик — официальный MHSanaei/3x-ui (v2.6.7), запускается через bash.</div>
        <div>• После установки применяются переданные логин/пароль/порт/web base path через <code>x-ui setting</code>.</div>
        <div>• В режиме «Домен» автоматически выпускается Let's Encrypt сертификат через acme.sh (нужны открытые 80/443 и A-запись).</div>
        <div>• SSH-пароль НЕ сохраняется в БД (в отличие от пароля панели — он сохраняется, чтобы дальше дергать API 3X-UI).</div>
      </Card>
    </div>
  );
}