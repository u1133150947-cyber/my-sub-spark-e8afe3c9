import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TG_GATEWAY = "https://connector-gateway.lovable.dev/telegram";

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
  const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const ADMIN_TG_ID = Deno.env.get("ADMIN_TELEGRAM_ID");

  if (!ADMIN_TG_ID) return json({ error: "ADMIN_TELEGRAM_ID не настроен" }, 500);
  if (!TELEGRAM_BOT_TOKEN && !(LOVABLE_API_KEY && TELEGRAM_API_KEY)) {
    return json({ error: "Telegram не настроен (нужен TELEGRAM_BOT_TOKEN или коннектор)" }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // === 1. Запросить код ===
    if (action === "request") {
      // чистим старые
      await supabase.from("admin_login_codes").delete().lt("expires_at", new Date().toISOString());

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const codeHash = await sha256(code);
      const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const { error: insErr } = await supabase.from("admin_login_codes").insert({
        code_hash: codeHash,
        expires_at: expires,
      });
      if (insErr) return json({ error: insErr.message }, 500);

      const payload = {
        chat_id: ADMIN_TG_ID,
        text: `🔐 Код для входа в панель: <b>${code}</b>\nДействителен 5 минут.`,
        parse_mode: "HTML",
      };
      const tgRes = TELEGRAM_BOT_TOKEN
        ? await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`${TG_GATEWAY}/sendMessage`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": TELEGRAM_API_KEY!,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
      const tgData = await tgRes.json().catch(() => ({}));
      if (!tgRes.ok) {
        return json({ error: `Telegram: ${tgRes.status} ${JSON.stringify(tgData)}` }, 500);
      }
      return json({ ok: true });
    }

    // === 2. Подтвердить код → выдать токен сессии ===
    if (action === "verify") {
      const { code } = await req.json().catch(() => ({ code: "" }));
      if (!code || typeof code !== "string" || code.length !== 6) {
        return json({ error: "Неверный формат кода" }, 400);
      }
      const codeHash = await sha256(code);
      const { data: rows, error } = await supabase
        .from("admin_login_codes")
        .select("*")
        .eq("code_hash", codeHash)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .limit(1);
      if (error) return json({ error: error.message }, 500);
      if (!rows || rows.length === 0) return json({ error: "Код неверный или просрочен" }, 401);

      await supabase.from("admin_login_codes").update({ used: true }).eq("id", rows[0].id);

      const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 дней
      await supabase.from("admin_sessions").insert({ token, expires_at: expires });
      return json({ ok: true, token, expires_at: expires });
    }

    // === 3. Проверить токен сессии ===
    if (action === "check") {
      const { token } = await req.json().catch(() => ({ token: "" }));
      if (!token) return json({ ok: false }, 401);
      const { data: rows } = await supabase
        .from("admin_sessions")
        .select("token")
        .eq("token", token)
        .gt("expires_at", new Date().toISOString())
        .limit(1);
      if (!rows || rows.length === 0) return json({ ok: false }, 401);
      return json({ ok: true });
    }

    // === 4. Выйти ===
    if (action === "logout") {
      const { token } = await req.json().catch(() => ({ token: "" }));
      if (token) await supabase.from("admin_sessions").delete().eq("token", token);
      return json({ ok: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});