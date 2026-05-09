import { supabase } from "@/integrations/supabase/client";

const TOKEN_KEY = "admin_session_token";

export function getAdminToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setAdminToken(t: string) {
  try { localStorage.setItem(TOKEN_KEY, t); } catch {}
}
export function clearAdminToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

async function call(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("admin-auth", {
    body: { action, ...payload },
  });
  if (error) throw error;
  return data as any;
}

export async function requestLoginCode() { return call("request_code"); }
export async function verifyLoginCode(code: string) { return call("verify_code", { code }); }
export async function checkSession(token: string) { return call("check_session", { token }); }
export async function logoutSession(token: string) { return call("logout", { token }); }