import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Send, ShieldCheck } from "lucide-react";

const TOKEN_KEY = "admin_session_token";

export default function Login() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<"idle" | "code">("idle");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestCode() {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-auth?action=request", {
        method: "POST",
        body: {},
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast.success("Код отправлен в Telegram");
      setStage("code");
    } catch (e: any) {
      toast.error(e.message || "Не удалось отправить код");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (code.length !== 6) {
      toast.error("Код должен быть 6 цифр");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-auth?action=verify", {
        method: "POST",
        body: { code },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      const token = (data as any)?.token;
      if (!token) throw new Error("Сервер не вернул токен");
      localStorage.setItem(TOKEN_KEY, token);
      toast.success("Добро пожаловать");
      navigate("/", { replace: true });
    } catch (e: any) {
      toast.error(e.message || "Неверный код");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Вход в панель
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {stage === "idle" && (
            <>
              <p className="text-sm text-muted-foreground">
                Нажми кнопку — бот пришлёт 6-значный код в твой Telegram.
              </p>
              <Button onClick={requestCode} disabled={busy} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Прислать код в Telegram
              </Button>
            </>
          )}
          {stage === "code" && (
            <>
              <p className="text-sm text-muted-foreground">Введи 6-значный код из сообщения бота:</p>
              <Input
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="text-center text-2xl tracking-widest"
                autoFocus
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStage("idle")} disabled={busy}>
                  Назад
                </Button>
                <Button onClick={verifyCode} disabled={busy || code.length !== 6} className="flex-1">
                  {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Войти
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export { TOKEN_KEY };