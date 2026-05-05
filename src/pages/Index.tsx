import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Plus, Trash2, Link2, Smartphone, Zap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

type Subscription = {
  id: string;
  slug: string;
  name: string;
  hits: number;
  last_accessed_at: string | null;
  created_at: string;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const subUrl = (slug: string) => `${SUPABASE_URL}/functions/v1/sub/${slug}`;
const happUrl = (slug: string) =>
  `happ://add/${encodeURIComponent(subUrl(slug))}`;

function randomSlug(len = 10) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => alphabet[n % alphabet.length]).join("");
}

const Index = () => {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [name, setName] = useState("");
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activeQr, setActiveQr] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Не удалось загрузить подписки");
      return;
    }
    setSubs(data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    if (!name.trim()) {
      toast.error("Введите имя/метку");
      return;
    }
    if (count < 1 || count > 50) {
      toast.error("Количество от 1 до 50");
      return;
    }
    setLoading(true);
    const rows = Array.from({ length: count }, (_, i) => ({
      slug: randomSlug(10),
      name: count > 1 ? `${name.trim()} #${i + 1}` : name.trim(),
    }));
    const { error } = await supabase.from("subscriptions").insert(rows);
    setLoading(false);
    if (error) {
      toast.error("Ошибка создания: " + error.message);
      return;
    }
    toast.success(`Создано: ${count}`);
    setName("");
    setCount(1);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("subscriptions").delete().eq("id", id);
    if (error) {
      toast.error("Не удалось удалить");
      return;
    }
    toast.success("Удалено");
    load();
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Скопировано");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 opacity-20"
          style={{ background: "var(--gradient-hero)" }}
          aria-hidden
        />
        <div className="container relative py-12 md:py-16">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="size-10 rounded-xl flex items-center justify-center"
              style={{ background: "var(--gradient-hero)" }}
            >
              <Zap className="size-5 text-primary-foreground" />
            </div>
            <span className="text-sm uppercase tracking-widest text-muted-foreground">
              Sub Generator
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight max-w-2xl">
            Генератор подписок для{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "var(--gradient-hero)" }}
            >
              Happ
            </span>
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl">
            Создавайте уникальные ссылки-обёртки над вашей подпиской ExtraVPN и
            раздавайте их клиентам.
          </p>
        </div>
      </header>

      <main className="container py-8 space-y-8">
        {/* Generator */}
        <Card
          className="p-6 border-border"
          style={{ background: "var(--gradient-card)" }}
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Plus className="size-4 text-primary" />
            Создать подписки
          </h2>
          <div className="grid gap-4 md:grid-cols-[1fr_140px_auto]">
            <Input
              placeholder="Имя клиента или метка"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
            />
            <Input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value || "1", 10))}
              placeholder="Кол-во"
            />
            <Button
              onClick={generate}
              disabled={loading}
              className="font-semibold"
              style={{ background: "var(--gradient-hero)", color: "hsl(var(--primary-foreground))" }}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Zap className="size-4 mr-1" />
                  Сгенерировать
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* List */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Подписки ({subs.length})</h2>
          </div>

          {subs.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground border-dashed">
              Подписок пока нет. Создайте первую выше.
            </Card>
          ) : (
            <div className="grid gap-3">
              {subs.map((s) => {
                const url = subUrl(s.slug);
                const happ = happUrl(s.slug);
                return (
                  <Card
                    key={s.id}
                    className="p-4 border-border"
                    style={{ background: "var(--gradient-card)" }}
                  >
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold truncate">{s.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                            {s.hits} hits
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Link2 className="size-3 shrink-0" />
                          <code className="truncate">{url}</code>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => copy(url)}
                        >
                          <Copy className="size-3.5 mr-1" /> URL
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => copy(happ)}
                          style={{
                            background: "var(--gradient-hero)",
                            color: "hsl(var(--primary-foreground))",
                          }}
                        >
                          <Smartphone className="size-3.5 mr-1" /> Happ
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveQr(activeQr === s.id ? null : s.id)}
                        >
                          QR
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(s.id)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {activeQr === s.id && (
                      <div className="mt-4 flex flex-col items-center gap-2 p-4 rounded-lg bg-secondary">
                        <div className="bg-white p-3 rounded">
                          <QRCodeSVG value={happ} size={180} />
                        </div>
                        <p className="text-xs text-muted-foreground break-all text-center max-w-xs">
                          {happ}
                        </p>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <footer className="text-center text-xs text-muted-foreground py-6">
          Подписки проксируются через защищённый бэкенд и ведут на ваш ExtraVPN.
        </footer>
      </main>
    </div>
  );
};

export default Index;
