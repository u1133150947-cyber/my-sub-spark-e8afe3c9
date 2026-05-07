// 3X-UI Sub Manager — single-binary self-hosted server.
// Replaces Supabase (PostgREST + Auth + Edge Functions) with one Deno process + SQLite.
// Run: deno run -A --unstable-kv server/main.ts
import { handleRest } from "./postgrest.ts";
import { handlePanel } from "./panel.ts";
import { handleSub } from "./sub.ts";
import { contentType } from "https://deno.land/std@0.224.0/media_types/mod.ts";
import { extname, join, normalize } from "https://deno.land/std@0.224.0/path/mod.ts";

const PORT = Number(Deno.env.get("PORT") ?? 8080);
const STATIC_DIR = Deno.env.get("STATIC_DIR") ?? "./dist";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer, range, x-supabase-api-version",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS, HEAD",
  "Access-Control-Expose-Headers": "content-range, content-profile",
};

async function serveStatic(url: URL): Promise<Response> {
  let p = decodeURIComponent(url.pathname);
  if (p === "/" || p === "") p = "/index.html";
  const safe = normalize(p).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(STATIC_DIR, safe);
  try {
    const file = await Deno.readFile(filePath);
    const ct = contentType(extname(filePath)) ?? "application/octet-stream";
    return new Response(file, { headers: { "content-type": ct, "cache-control": "public, max-age=300" } });
  } catch {
    // SPA fallback
    try {
      const html = await Deno.readFile(join(STATIC_DIR, "index.html"));
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // Subscription endpoint — must be reachable both as /sub/<slug> and /functions/v1/sub/<slug>
  if (url.pathname.startsWith("/sub/") || url.pathname.startsWith("/functions/v1/sub")) {
    return withCors(await handleSub(req, url));
  }
  if (url.pathname.startsWith("/functions/v1/panel")) {
    return withCors(await handlePanel(req, url));
  }
  if (url.pathname.startsWith("/rest/v1/")) {
    return withCors(await handleRest(req, url));
  }
  // Stub auth endpoints so supabase-js doesn't error if it tries to refresh tokens.
  if (url.pathname.startsWith("/auth/v1/")) {
    return new Response(JSON.stringify({}), { status: 200, headers: { ...cors, "content-type": "application/json" } });
  }

  return await serveStatic(url);
});

console.log(`✓ 3X-UI Sub Manager listening on :${PORT}`);