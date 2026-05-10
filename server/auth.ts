// Shared admin-session verification used by REST, panel, and update handlers.
import { db } from "./db.ts";

function isoNow() { return new Date().toISOString(); }

/**
 * Returns true if the request carries a valid, non-expired admin session token.
 * Checks the "x-admin-token" header (used by the web app) or
 * the "authorization" header as "Bearer <token>" (fallback for API clients).
 */
export function verifyAdminSession(req: Request): boolean {
  let token = req.headers.get("x-admin-token")?.trim() ?? "";
  if (!token) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth.toLowerCase().startsWith("bearer ")) token = auth.slice(7).trim();
  }
  if (!token) return false;
  try {
    const rows = db.queryEntries(
      `SELECT token FROM admin_sessions WHERE token = ? AND datetime(expires_at) > datetime(?) LIMIT 1`,
      [token, isoNow()],
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

export function unauthorizedResponse(cors: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({ error: "unauthorized — admin login required" }),
    {
      status: 401,
      headers: { ...cors, "content-type": "application/json" },
    },
  );
}
