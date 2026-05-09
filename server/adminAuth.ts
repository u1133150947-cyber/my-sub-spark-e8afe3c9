import { db, uid } from "./db.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

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
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => alphabet[n % alphabet.length]).join("");
}

function iso(ms: number) { return new Date(ms).toISOString(); }

async function sendTelegram(code: string) {
  const botToken = Deno.env.get("ADMIN_BOT_TOKEN") || Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("ADMIN_TELEGRAM_ID");
  if (!botToken) throw new Error("ADMIN_BOT_TOKEN не задан в .env на сервере");
  if (!chatId) throw new Error("ADMIN_TELEGRAM_ID не задан в .env на сервере");

  const text = `🔐 Код для входа в админку: <b>${code}</b>\nДействителен 5 минут.`;
  const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`Telegram ${r.status}: ${body.slice(0, 300)}`);
}

export async function handleAdminAuth(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const body = await req.json().catch(() => ({}));
  const action = String((body as any).action ?? "");

  try {
    if (action === "request_code") {
      const since = iso(Date.now() - 60_000);
      const recent = db.queryEntries(
        `SELECT id FROM admin_login_codes WHERE used = 0 AND datetime(created_at) > datetime(?) LIMIT 1`,
        [since],
      );
      if (recent.length) return json({ ok: true, throttled: true, message: "Код уже отправлен, подожди минуту" });

      const code = randomCode();
      const hash = await sha256Hex(code);
      const expires = iso(Date.now() + 5 * 60_000);
      await sendTelegram(code);
      db.query(`INSERT INTO admin_login_codes (id, code_hash, expires_at, used) VALUES (?, ?, ?, 0)`, [uid(), hash, expires]);
      return json({ ok: true });
    }

    if (action === "verify_code") {
      const code = String((body as any).code ?? "").trim();
      if (!/^\d{6}$/.test(code)) return json({ error: "bad_code" }, 400);
      const hash = await sha256Hex(code);
      const now = iso(Date.now());
      const rows = db.queryEntries(
        `SELECT id FROM admin_login_codes WHERE code_hash = ? AND used = 0 AND datetime(expires_at) > datetime(?) LIMIT 1`,
        [hash, now],
      );
      if (!rows.length) return json({ error: "invalid_or_expired" }, 401);

      db.query(`UPDATE admin_login_codes SET used = 1 WHERE id = ?`, [(rows[0] as any).id]);
      const token = randomToken();
      const expires = iso(Date.now() + 30 * 24 * 60 * 60_000);
      db.query(`INSERT INTO admin_sessions (id, token, expires_at) VALUES (?, ?, ?)`, [uid(), token, expires]);
      db.query(`DELETE FROM admin_sessions WHERE datetime(expires_at) < datetime(?)`, [now]);
      db.query(`DELETE FROM admin_login_codes WHERE datetime(expires_at) < datetime(?)`, [now]);
      return json({ ok: true, token, expires_at: expires });
    }

    if (action === "check_session") {
      const token = String((body as any).token ?? "");
      if (!token) return json({ valid: false });
      const rows = db.queryEntries(
        `SELECT token FROM admin_sessions WHERE token = ? AND datetime(expires_at) > datetime(?) LIMIT 1`,
        [token, iso(Date.now())],
      );
      return json({ valid: rows.length > 0 });
    }

    if (action === "logout") {
      const token = String((body as any).token ?? "");
      if (token) db.query(`DELETE FROM admin_sessions WHERE token = ?`, [token]);
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("admin-auth:", message);
    return json({ error: message }, 500);
  }
}