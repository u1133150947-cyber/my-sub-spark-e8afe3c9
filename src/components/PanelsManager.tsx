import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Plus, Server, Trash2, Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

type Panel = {
  id: string;
  name: string;
  host: string;
  public_host: string;
  panel_url: string;
  username: string;
  password: string;
  template: string;
  readiness: string;
  ssh_user: string;
  ssh_port: number;
  ssh_auth_type: string;
  ssh_password: string;
  ssh_key_passphrase: string;
  status: string;
  status_message: string;
  last_checked_at: string | null;
};

const TEMPLATES = [
  { value: "cascade_yandex", label: "Каскад через Яндекс" },
  { value: "cascade_youtube", label: "Каскад через YouTube-фронт" },
  { value: "direct", label: "Только прямой" },
];

const READINESS = [
  { value: "auto", label: "Определи сам" },
  { value: "empty", label: "Пустой сервер" },
  { value: "ready", label: "Панель уже стоит" },
];

const SSH_AUTH = [
  { value: "password", label: "Пароль" },
  { value: "key", label: "Ключ" },
];

const empty = {
  name: "",
  host: "",
  public_host: "",
  panel_url: "",
  username: "",
  password: "",
  template: "cascade_yandex",
  readiness: "auto",
  ssh_user: "root",
  ssh_port: 22,
  ssh_auth_type: "password",
  ssh_password: "",
  ssh_key_passphrase: "",
};

export const PanelsManager = () => {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("panels")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) return toast.error("Не удалось загрузить серверы");
    setPanels((data ?? []) as Panel[]);
  };

  useEffect(() => {
    load();
  }, []);

  const update = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const add = async (alsoSetup: boolean) => {
    if (!form.name.trim() || !form.host.trim() || !form.panel_url.trim()) {
      return toast.error("Заполните Название, IP/хост и URL панели");
    }
    if (!form.username.trim() || !form.password.trim()) {
      return toast.error("Логин и пароль панели обязательны");
    }
    setSaving(true);
    const { error } = await supabase.from("panels").insert({
      ...form,
      public_host: form.public_host || form.host,
    });
    setSaving(false);
    if (error) return toast.error("Ошибка: " + error.message);
    toast.success(alsoSetup ? "Сервер добавлен (автонастройка появится позже)" : "Сервер добавлен");
    setForm({ ...empty });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить сервер?")) return;
    const { error } = await supabase.from("panels").delete().eq("id", id);
    if (error) return toast.error("Ошибка удаления");
    toast.success("Удалено");
    load();
  };

  const testConnection = async (p: Panel) => {
    setTestingId(p.id);
    try {
      const { data, error } = await supabase.functions.invoke("panel?action=testPanel", {
        method: "POST",
        body: { panel_url: p.panel_url, username: p.username, password: p.password },
      });
      if (error) throw error;
      const ok = !!data?.ok;
      const msg = ok ? "" : data?.error ?? "Неизвестная ошибка";
      await supabase
        .from("panels")
        .update({
          status: ok ? "ok" : "error",
          status_message: msg,
          last_checked_at: new Date().toISOString(),
        })
        .eq("id", p.id);
      ok ? toast.success(`${p.name}: подключение работает`) : toast.error(`${p.name}: ${msg}`);
      load();
    } catch (e: any) {
      toast.error("Ошибка проверки: " + (e?.message ?? e));
    } finally {
      setTestingId(null);
    }
  };

  const Sel = (props: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <div>
      <Label className="text-xs text-muted-foreground">{props.label}</Label>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="p-6 border-border" style={{ background: "var(--gradient-card)" }}>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <Plus className="size-4 text-primary" /> Добавить сервер
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          После добавления сервер можно сразу отправить в задачу автоматической настройки.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label className="text-xs text-muted-foreground">Название</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="🇨🇿 Чехия #1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">IP / хост</Label>
            <Input value={form.host} onChange={(e) => update("host", e.target.value)} placeholder="1.2.3.4" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Публичный хост</Label>
            <Input
              value={form.public_host}
              onChange={(e) => update("public_host", e.target.value)}
              placeholder="vpn.example.com"
            />
          </div>

          <Sel label="Шаблон" value={form.template} onChange={(v) => update("template", v)} options={TEMPLATES} />
          <Sel label="Готовность сервера" value={form.readiness} onChange={(v) => update("readiness", v)} options={READINESS} />
          <div>
            <Label className="text-xs text-muted-foreground">SSH пользователь</Label>
            <Input value={form.ssh_user} onChange={(e) => update("ssh_user", e.target.value)} />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">SSH порт</Label>
            <Input
              type="number"
              value={form.ssh_port}
              onChange={(e) => update("ssh_port", parseInt(e.target.value || "22", 10))}
            />
          </div>
          <Sel label="Тип SSH" value={form.ssh_auth_type} onChange={(v) => update("ssh_auth_type", v)} options={SSH_AUTH} />
          <div>
            <Label className="text-xs text-muted-foreground">
              {form.ssh_auth_type === "key" ? "Пароль ключа" : "SSH пароль"}
            </Label>
            <Input
              type="password"
              value={form.ssh_auth_type === "key" ? form.ssh_key_passphrase : form.ssh_password}
              onChange={(e) =>
                update(form.ssh_auth_type === "key" ? "ssh_key_passphrase" : "ssh_password", e.target.value)
              }
            />
          </div>

          <div className="md:col-span-3 border-t border-border pt-4 mt-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Доступ к 3X-UI панели</Label>
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs text-muted-foreground">URL панели</Label>
            <Input
              value={form.panel_url}
              onChange={(e) => update("panel_url", e.target.value)}
              placeholder="https://1.2.3.4:54321/secret-path"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Логин панели</Label>
            <Input value={form.username} onChange={(e) => update("username", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Пароль панели</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-secondary/50 text-sm text-muted-foreground">
          Панель сама проверит, что уже установлено на сервере, и докачает только недостающее.
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            onClick={() => add(true)}
            disabled={saving}
            style={{ background: "var(--gradient-hero)", color: "hsl(var(--primary-foreground))" }}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Добавить и настроить"}
          </Button>
          <Button variant="outline" onClick={() => add(false)} disabled={saving}>
            Только добавить
          </Button>
        </div>
      </Card>

      <section>
        <h2 className="text-lg font-semibold mb-4">Серверы ({panels.length})</h2>
        {panels.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground border-dashed">Серверов пока нет.</Card>
        ) : (
          <div className="grid gap-3">
            {panels.map((p) => (
              <Card key={p.id} className="p-4 border-border" style={{ background: "var(--gradient-card)" }}>
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Server className="size-4 text-primary shrink-0" />
                      <span className="font-semibold truncate">{p.name}</span>
                      {p.status === "ok" ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400 flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> онлайн
                        </span>
                      ) : p.status === "error" ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive flex items-center gap-1">
                          <AlertCircle className="size-3" /> ошибка
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                          не проверен
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        {TEMPLATES.find((t) => t.value === p.template)?.label ?? p.template}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.host} → <code>{p.panel_url}</code>
                    </div>
                    {p.status === "error" && p.status_message && (
                      <div className="text-xs text-destructive mt-1 truncate">{p.status_message}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testConnection(p)}
                      disabled={testingId === p.id}
                    >
                      {testingId === p.id ? (
                        <Loader2 className="size-3.5 mr-1 animate-spin" />
                      ) : p.status === "ok" ? (
                        <Wifi className="size-3.5 mr-1" />
                      ) : (
                        <WifiOff className="size-3.5 mr-1" />
                      )}
                      Проверить
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(p.id)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};