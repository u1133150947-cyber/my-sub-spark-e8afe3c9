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
  return String(arr[0] % 1_000_000).padStart(6, "0");
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
  if (!botToken) throw new Error("ADMIN_BOT_TOKEN не задан в .env на сервере");
  const chatId = await getAdminChatId(botToken);

  const text = `🔐 Код для входа в админку: <b>${code}</b>\nДействителен 5 минут.`;
  const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`Telegram ${r.status}: ${body.slice(0, 300)}`);
  console.log(`admin-auth: login code sent to Telegram chat ${String(chatId).replace(/.(?=.{4})/g, "*")}`);
}

async function getAdminChatId(botToken: string): Promise<string> {
  const fromEnv = Deno.env.get("ADMIN_TELEGRAM_ID")?.trim();
  if (fromEnv) return fromEnv;

  const saved = db.queryEntries(`SELECT value FROM admin_settings WHERE key = 'telegram_chat_id' LIMIT 1`);
  const savedValue = String((saved[0] as any)?.value ?? "").trim();
  if (savedValue) return savedValue;

  const r = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ limit: 20, timeout: 0, allowed_updates: ["message"] }),
  });
  const data = await r.json().catch(() => null) as any;
  if (!r.ok || !data?.ok) throw new Error(`Telegram getUpdates failed: ${JSON.stringify(data).slice(0, 300)}`);

  const updates = Array.isArray(data.result) ? data.result : [];
  const msg = updates.map((u: any) => u?.message).reverse().find((m: any) => m?.chat?.id && m?.chat?.type === "private");
  const chatId = msg?.chat?.id ? String(msg.chat.id) : "";
  if (!chatId) throw new Error("Открой Telegram-бота, нажми Start или отправь /start, потом запроси код ещё раз");

  db.query(
    `INSERT INTO admin_settings (key, value, updated_at) VALUES ('telegram_chat_id', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    [chatId],
  );
  return chatId;
}

// Max wrong guesses before the active OTP code is invalidated.
const MAX_VERIFY_ATTEMPTS = 5;

export async function handleAdminAuth(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const body = await req.json().catch(() => ({}));
  const action = String((body as any).action ?? "");

  try {
    // ─── request_code ──────────────────────────────────────────────────────────
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
      db.query(
        `INSERT INTO admin_login_codes (id, code_hash, expires_at, used, failed_attempts) VALUES (?, ?, ?, 0, 0)`,
        [uid(), hash, expires],
      );
      return json({ ok: true });
    }

    // ─── verify_code ───────────────────────────────────────────────────────────
    if (action === "verify_code") {
      const code = String((body as any).code ?? "").trim();
      if (!/^\d{6}$/.test(code)) return json({ error: "bad_code" }, 400);

      const now = iso(Date.now());

      // Find any active (not expired, not used) code regardless of hash —
      // we need its id to increment failed_attempts even on wrong guesses.
      const active = db.queryEntries(
        `SELECT id, code_hash, failed_attempts FROM admin_login_codes
         WHERE used = 0 AND datetime(expires_at) > datetime(?)
         ORDER BY created_at DESC LIMIT 1`,
        [now],
      ) as any[];

      if (!active.length) {
        return json({ error: "invalid_or_expired" }, 401);
      }

      const { id: codeId, code_hash: storedHash, failed_attempts: failedRaw } = active[0];
      const failedAttempts = Number(failedRaw ?? 0);

      // Brute-force gate: if already at limit, invalidate and reject.
      if (failedAttempts >= MAX_VERIFY_ATTEMPTS) {
        db.query(`UPDATE admin_login_codes SET used = 1 WHERE id = ?`, [codeId]);
        console.warn(`admin-auth: code invalidated after ${MAX_VERIFY_ATTEMPTS} failed attempts`);
        return json({ error: "too_many_attempts" }, 429);
      }

      const submittedHash = await sha256Hex(code);
      if (submittedHash !== storedHash) {
        // Wrong code — increment counter; invalidate when limit reached.
        const newFailed = failedAttempts + 1;
        if (newFailed >= MAX_VERIFY_ATTEMPTS) {
          db.query(`UPDATE admin_login_codes SET used = 1, failed_attempts = ? WHERE id = ?`, [newFailed, codeId]);
          console.warn(`admin-auth: code invalidated after reaching ${MAX_VERIFY_ATTEMPTS} failed attempts`);
          return json({ error: "too_many_attempts" }, 429);
        }
        db.query(`UPDATE admin_login_codes SET failed_attempts = ? WHERE id = ?`, [newFailed, codeId]);
        const remaining = MAX_VERIFY_ATTEMPTS - newFailed;
        return json({ error: "invalid_or_expired", attempts_remaining: remaining }, 401);
      }

      // Correct code — mark used, create session, clean up.
      db.query(`UPDATE admin_login_codes SET used = 1 WHERE id = ?`, [codeId]);
      const token = randomToken();
      const expires = iso(Date.now() + 30 * 24 * 60 * 60_000);
      db.query(`INSERT INTO admin_sessions (id, token, expires_at) VALUES (?, ?, ?)`, [uid(), token, expires]);
      // GC: expired sessions and codes
      db.query(`DELETE FROM admin_sessions WHERE datetime(expires_at) < datetime(?)`, [now]);
      db.query(`DELETE FROM admin_login_codes WHERE datetime(expires_at) < datetime(?)`, [now]);
      console.log("admin-auth: new session created");
      return json({ ok: true, token, expires_at: expires });
    }

    // ─── check_session ─────────────────────────────────────────────────────────
    if (action === "check_session") {
      const token = String((body as any).token ?? "");
      if (!token) return json({ valid: false });
      const rows = db.queryEntries(
        `SELECT token FROM admin_sessions WHERE token = ? AND datetime(expires_at) > datetime(?) LIMIT 1`,
        [token, iso(Date.now())],
      );
      return json({ valid: rows.length > 0 });
    }

    // ─── logout ────────────────────────────────────────────────────────────────
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
