import { db } from "./db.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export async function handleHy2Auth(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: cors });

  try {
    const body = await req.json();
    const { addr, auth } = body;
    if (!auth) {
      return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { ...cors, "content-type": "application/json" } });
    }

    // Check if auth matches a valid subscription client_uuid
    const sub = db.queryEntries(`
      SELECT id, client_uuid, expiry_ms, total_bytes
      FROM subscriptions
      WHERE client_uuid = ? OR id::text = ?
    `, [auth, auth])[0] as any;

    if (!sub) {
      return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { ...cors, "content-type": "application/json" } });
    }

    const nowMs = Date.now();
    const expiryMs = Number(sub.expiry_ms);
    if (expiryMs > 0 && nowMs > expiryMs) {
      return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { ...cors, "content-type": "application/json" } });
    }

    // (Optional) Here we could check traffic_snapshots or sub's total_bytes vs used_bytes
    // For now, if the sub exists and isn't expired, we allow it.
    
    return new Response(JSON.stringify({ ok: true, id: sub.client_uuid }), { status: 200, headers: { ...cors, "content-type": "application/json" } });

  } catch (e: any) {
    console.error("[hy2 auth error]", e.message);
    return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { ...cors, "content-type": "application/json" } });
  }
}
