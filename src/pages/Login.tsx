import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Send, ShieldCheck } from "lucide-react";
import { requestLoginCode, verifyLoginCode, setAdminToken } from "@/lib/adminAuth";

export default function Login() {
  const nav = useNavigate();
  const [step, setStep] = useState<"request" | "verify">("request");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function onRequest() {
    setLoading(true);
    try {
      const r = await requestLoginCode();
      if (r?.error) throw new Error(r.error);
      toast.success(r?.throttled ? "Код уже был отправлен" : "Код отправлен в Telegram");
      setStep("verify");
    } catch (e: any) {
      toast.error("Не удалось отправить код", { description: String(e?.message ?? e) });
    } finally { setLoading(false); }
  }

  async function onVerify() {
    if (!/^\d{6}$/.test(code)) { toast.error("Код — 6 цифр"); return; }
    setLoading(true);
    try {
      const r = await verifyLoginCode(code);
      if (r?.error || !r?.token) throw new Error(r?.error ?? "no_token");
      setAdminToken(r.token);
      toast.success("Вход выполнен");
      nav("/", { replace: true });
    } catch (e: any) {
      toast.error("Неверный или истёкший код", { description: String(e?.message ?? e) });
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">Вход в админку</h1>
          <p className="text-sm text-muted-foreground">
            {step === "request"
              ? "Получи 6-значный код в Telegram-боте"
              : "Введи код из Telegram"}
          </p>
        </div>

        {step === "request" ? (
          <Button onClick={onRequest} disabled={loading} className="w-full" size="lg">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Отправить код в Telegram
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Код подтверждения</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className="text-center text-2xl tracking-[0.5em] font-mono"
                onKeyDown={(e) => { if (e.key === "Enter") onVerify(); }}
                autoFocus
              />
            </div>
            <Button onClick={onVerify} disabled={loading || code.length !== 6} className="w-full" size="lg">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Войти
            </Button>
            <Button variant="ghost" onClick={() => { setStep("request"); setCode(""); }} className="w-full" size="sm">
              Запросить новый код
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}