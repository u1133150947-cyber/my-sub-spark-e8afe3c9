import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false }, 200);

  try {
    const body = await req.json().catch(() => ({}));
    const auth = String(body?.auth ?? "").trim();
    if (!auth) return json({ ok: false });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("id, client_uuid, expiry_ms")
      .or(`client_uuid.eq.${auth},id.eq.${auth}`)
      .maybeSingle();

    if (error || !sub) return json({ ok: false });

    const expiryMs = Number(sub.expiry_ms ?? 0);
    if (expiryMs > 0 && Date.now() > expiryMs) return json({ ok: false });

    return json({ ok: true, id: sub.client_uuid || sub.id });
  } catch (e) {
    console.error("[hy2-auth]", e instanceof Error ? e.message : String(e));
    return json({ ok: false });
  }
});