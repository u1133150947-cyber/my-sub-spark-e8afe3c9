// Admin auth via Telegram bot.
// Actions:
//   request_code  -> generates 6-digit code, stores hash, sends to admin via Telegram
//   verify_code   -> verifies code, returns session token (random 48 chars)
//   check_session -> validates session token, returns {valid: true} if ok
//   logout        -> deletes session token
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("ADMIN_BOT_TOKEN") ?? Deno.env.get("TELEGRAM_BOT_TOKEN");
const ADMIN_TG_ID = Deno.env.get("ADMIN_TELEGRAM_ID");

const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomCode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1000000).padStart(6, "0");
}

function randomToken(len = 48): string {
  const a = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => a[n % a.length]).join("");
}

async function sendTelegram(text: string): Promise<void> {
  if (!BOT_TOKEN || !ADMIN_TG_ID) throw new Error("TG bot not configured");
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: ADMIN_TG_ID, text, parse_mode: "HTML" }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`telegram ${r.status}: ${body.slice(0, 200)}`);
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: any = {};
  try { body = await req.json(); } catch {}
  const action = String(body.action ?? "");

  try {
    if (action === "request_code") {
      // A fresh request should always create and send a fresh code. This avoids
      // stale unsent codes blocking Telegram login after a failed delivery.
      await supa.from("admin_login_codes").delete().eq("used", false);

      const code = randomCode();
      const code_hash = await sha256Hex(code);
      const expires_at = new Date(Date.now() + 5 * 60_000).toISOString();
      const { error } = await supa.from("admin_login_codes").insert({ code_hash, expires_at });
      if (error) throw error;

      try {
        await sendTelegram(`🔐 Код для входа в админку: <b>${code}</b>\nДействителен 5 минут.`);
      } catch (e) {
        await supa.from("admin_login_codes").delete().eq("code_hash", code_hash);
        throw e;
      }
      return json({ ok: true });
    }

    if (action === "verify_code") {
      const code = String(body.code ?? "").trim();
      if (!/^\d{6}$/.test(code)) return json({ error: "bad code" }, 400);
      const code_hash = await sha256Hex(code);
      const nowIso = new Date().toISOString();

      const { data: rows, error } = await supa
        .from("admin_login_codes")
        .select("id, expires_at, used")
        .eq("code_hash", code_hash)
        .eq("used", false)
        .gt("expires_at", nowIso)
        .limit(1);
      if (error) throw error;
      if (!rows || !rows.length) return json({ error: "invalid_or_expired" }, 401);

      await supa.from("admin_login_codes").update({ used: true }).eq("id", rows[0].id);

      const token = randomToken();
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString();
      const ins = await supa.from("admin_sessions").insert({ token, expires_at: expires });
      if (ins.error) throw ins.error;

      // best-effort cleanup of expired
      await supa.from("admin_sessions").delete().lt("expires_at", nowIso);
      await supa.from("admin_login_codes").delete().lt("expires_at", nowIso);

      return json({ ok: true, token, expires_at: expires });
    }

    if (action === "check_session") {
      const token = String(body.token ?? "");
      if (!token) return json({ valid: false });
      const { data } = await supa
        .from("admin_sessions")
        .select("token, expires_at")
        .eq("token", token)
        .gt("expires_at", new Date().toISOString())
        .limit(1);
      return json({ valid: !!(data && data.length) });
    }

    if (action === "logout") {
      const token = String(body.token ?? "");
      if (token) await supa.from("admin_sessions").delete().eq("token", token);
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e: any) {
    console.error("admin-auth error:", e?.message ?? e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});