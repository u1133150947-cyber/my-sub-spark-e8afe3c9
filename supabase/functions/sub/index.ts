import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UPSTREAM = "https://sub.extravpn.info/yaHZXFQct85CrfUT";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // path: /sub/<slug>
    const parts = url.pathname.split("/").filter(Boolean);
    const slug = parts[parts.length - 1];

    if (!slug || slug === "sub") {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("id, hits")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !sub) {
      return new Response("Subscription not found", { status: 404, headers: corsHeaders });
    }

    // Forward request to upstream, passing through useful headers
    const upstreamRes = await fetch(UPSTREAM, {
      headers: {
        "User-Agent": req.headers.get("user-agent") ?? "Happ",
        "Accept": req.headers.get("accept") ?? "*/*",
      },
    });

    const body = await upstreamRes.text();

    // Update hit counter (fire and forget)
    supabase
      .from("subscriptions")
      .update({ hits: (sub.hits ?? 0) + 1, last_accessed_at: new Date().toISOString() })
      .eq("id", sub.id)
      .then(() => {});

    // Forward all upstream headers except hop-by-hop / encoding ones
    const SKIP = new Set([
      "connection",
      "keep-alive",
      "transfer-encoding",
      "content-encoding",
      "content-length",
      "vary",
      "strict-transport-security",
      "set-cookie",
      "server",
      "date",
      "alt-svc",
    ]);
    const passthroughHeaders: Record<string, string> = { ...corsHeaders };
    upstreamRes.headers.forEach((value, key) => {
      if (!SKIP.has(key.toLowerCase())) {
        passthroughHeaders[key] = value;
      }
    });

    return new Response(body, {
      status: upstreamRes.status,
      headers: passthroughHeaders,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(`Error: ${msg}`, { status: 500, headers: corsHeaders });
  }
});