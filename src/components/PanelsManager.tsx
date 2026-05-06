import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Plus, Server, Trash2, Wifi, WifiOff, CheckCircle2, AlertCircle, Pencil, Check, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Panel = {
  id: string;
  name: string;
  panel_url: string;
  username: string;
  password: string;
  status: string;
  status_message: string;
  last_checked_at: string | null;
};

const empty = { name: "", panel_url: "", username: "", password: "" };

const FLAG_MAP: { keys: string[]; flag: string }[] = [
  { keys: ["россия", "russia", "ru", "москв", "спб", "питер"], flag: "🇷🇺" },
  { keys: ["чехия", "czech", "cz", "прага", "prague"], flag: "🇨🇿" },
  { keys: ["германия", "germany", "de", "берлин", "франкфурт"], flag: "🇩🇪" },
  { keys: ["нидерланд", "netherlands", "nl", "амстердам"], flag: "🇳🇱" },
  { keys: ["франция", "france", "fr", "париж"], flag: "🇫🇷" },
  { keys: ["великобритания", "британия", "uk", "gb", "лондон"], flag: "🇬🇧" },
  { keys: ["сша", "usa", "us", "америк"], flag: "🇺🇸" },
  { keys: ["канада", "canada", "ca"], flag: "🇨🇦" },
  { keys: ["япония", "japan", "jp", "токио"], flag: "🇯🇵" },
  { keys: ["сингапур", "singapore", "sg"], flag: "🇸🇬" },
  { keys: ["турция", "turkey", "tr", "стамбул"], flag: "🇹🇷" },
  { keys: ["украина", "ukraine", "ua", "киев"], flag: "🇺🇦" },
  { keys: ["польша", "poland", "pl", "варшава"], flag: "🇵🇱" },
  { keys: ["финляндия", "finland", "fi", "хельсинки"], flag: "🇫🇮" },
  { keys: ["швеция", "sweden", "se"], flag: "🇸🇪" },
  { keys: ["норвегия", "norway", "no"], flag: "🇳🇴" },
  { keys: ["испания", "spain", "es"], flag: "🇪🇸" },
  { keys: ["италия", "italy", "it"], flag: "🇮🇹" },
  { keys: ["швейцария", "swiss", "ch"], flag: "🇨🇭" },
  { keys: ["австрия", "austria", "at"], flag: "🇦🇹" },
  { keys: ["казахстан", "kazakhstan", "kz"], flag: "🇰🇿" },
  { keys: ["китай", "china", "cn"], flag: "🇨🇳" },
  { keys: ["гонконг", "hong kong", "hk"], flag: "🇭🇰" },
  { keys: ["индия", "india", "in"], flag: "🇮🇳" },
  { keys: ["бразилия", "brazil", "br"], flag: "🇧🇷" },
  { keys: ["оаэ", "uae", "дубай", "dubai"], flag: "🇦🇪" },
  { keys: ["латвия", "latvia", "lv", "рига"], flag: "🇱🇻" },
  { keys: ["литва", "lithuania", "lt"], flag: "🇱🇹" },
  { keys: ["эстония", "estonia", "ee"], flag: "🇪🇪" },
];

const FLAG_RE = /\p{Extended_Pictographic}/u;

const detectFlag = (name: string): string => {
  if (FLAG_RE.test(name)) return "";
  const lower = name.toLowerCase();
  for (const { keys, flag } of FLAG_MAP) {
    if (keys.some((k) => new RegExp(`\\b${k}`, "i").test(lower))) return flag;
  }
  return "";
};

const withFlag = (name: string) => {
  const f = detectFlag(name);
  return f ? `${f} ${name}` : name;
};

export const PanelsManager = ({ onChanged }: { onChanged?: () => void } = {}) => {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("panels")
      .select("id, name, panel_url, username, password, status, status_message, last_checked_at")
      .order("created_at", { ascending: true });
    if (error) return toast.error("Не удалось загрузить панели");
    setPanels((data ?? []) as Panel[]);
  };

  useEffect(() => {
    load();
  }, []);

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const add = async () => {
    if (!form.name.trim() || !form.panel_url.trim() || !form.username.trim() || !form.password.trim()) {
      return toast.error("Заполните название, URL панели, логин и пароль");
    }
    setSaving(true);
    let host = "";
    try {
      host = new URL(form.panel_url).hostname;
    } catch {
      host = form.panel_url;
    }
    const { error } = await supabase.from("panels").insert({
      name: form.name.trim(),
      panel_url: form.panel_url.trim(),
      username: form.username.trim(),
      password: form.password,
      host,
      public_host: host,
    });
    setSaving(false);
    if (error) return toast.error("Ошибка: " + error.message);
    toast.success("Панель добавлена");
    setForm({ ...empty });
    load();
    onChanged?.();
  };

  const remove = async (id: string) => {
    const panel = panels.find((x) => x.id === id);
    const { count } = await supabase
      .from("subscription_inbounds")
      .select("id", { count: "exact", head: true })
      .eq("panel", panel?.name ?? "");
    const msg = count && count > 0
      ? `Удалить панель «${panel?.name}»?\n\nОна используется в ${count} подписк(ах) — пропадёт у пользователей при следующем обновлении подписки.`
      : `Удалить панель «${panel?.name}»?`;
    if (!confirm(msg)) return;
    const { error } = await supabase.from("panels").delete().eq("id", id);
    if (error) return toast.error("Ошибка удаления");
    toast.success(count && count > 0 ? `Удалено. Очищено подписок: ${count}` : "Удалено");
    load();
    onChanged?.();
  };

  const startEdit = (p: Panel) => {
    setEditingId(p.id);
    setEditName(p.name);
  };

  const saveEdit = async (p: Panel) => {
    const newName = editName.trim();
    if (!newName || newName === p.name) {
      setEditingId(null);
      return;
    }
    const { error } = await supabase.from("panels").update({ name: newName }).eq("id", p.id);
    if (error) return toast.error("Ошибка: " + error.message);
    toast.success("Название обновлено — изменится во всех подписках");
    setEditingId(null);
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

  return (
    <div className="space-y-6">
      <Card className="p-6 border-border" style={{ background: "var(--gradient-card)" }}>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <Plus className="size-4 text-primary" /> Добавить панель
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Подключаем существующую 3X-UI панель — укажи URL, логин и пароль, остальное подтянется автоматически.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label className="text-xs text-muted-foreground">Название</Label>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="shrink-0 px-3 text-lg" title="Выбрать флаг">
                    {(form.name.match(FLAG_RE)?.[0]) || "🏳️"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto w-56">
                  {FLAG_MAP.map(({ flag, keys }) => (
                    <DropdownMenuItem
                      key={flag}
                      onClick={() => {
                        const cleaned = form.name.replace(FLAG_RE, "").trimStart();
                        update("name", `${flag} ${cleaned}`.trimEnd());
                      }}
                    >
                      <span className="text-lg mr-2">{flag}</span>
                      <span className="capitalize">{keys[0]}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="🇨🇿 Чехия #1"
                className="flex-1"
              />
            </div>
          </div>
          <div className="md:col-span-2">
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
            <Input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} />
          </div>
        </div>

        <Button
          onClick={add}
          disabled={saving}
          className="mt-4"
          style={{ background: "var(--gradient-hero)", color: "hsl(var(--primary-foreground))" }}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : (<><Plus className="size-4 mr-1" /> Добавить панель</>)}
        </Button>
      </Card>

      <section>
        <h2 className="text-lg font-semibold mb-4">Панели ({panels.length})</h2>
        {panels.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground border-dashed">Панелей пока нет.</Card>
        ) : (
          <div className="grid gap-3">
            {panels.map((p) => (
              <Card key={p.id} className="p-4 border-border" style={{ background: "var(--gradient-card)" }}>
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Server className="size-4 text-primary shrink-0" />
                      {editingId === p.id ? (
                        <>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(p);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            autoFocus
                            className="h-7 max-w-xs"
                          />
                          <Button size="sm" variant="ghost" onClick={() => saveEdit(p)} className="h-7 px-2">
                            <Check className="size-3.5 text-green-500" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 px-2">
                            <X className="size-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="font-semibold truncate">{withFlag(p.name)}</span>
                          <Button size="sm" variant="ghost" onClick={() => startEdit(p)} className="h-6 px-1.5">
                            <Pencil className="size-3 text-muted-foreground" />
                          </Button>
                        </>
                      )}
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
                          не проверена
                        </span>
                      )}
                    </div>
                    <code className="text-xs text-muted-foreground truncate block">{p.panel_url || "URL не задан"}</code>
                    {p.status === "error" && p.status_message && (
                      <div className="text-xs text-destructive mt-1 truncate">{p.status_message}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testConnection(p)}
                      disabled={testingId === p.id || !p.panel_url}
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
