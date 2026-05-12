// 3X-UI Sub Manager — single-binary self-hosted server.
// Replaces Supabase (PostgREST + Auth + Edge Functions) with one Deno process + SQLite.
// Run: deno run -A --unstable-kv server/main.ts
import { handleRest } from "./postgrest.ts";
import { handlePanel } from "./panel.ts";
import { handleSub } from "./sub.ts";
import { handleUpdate, handleVersion, handleUpdateFromGithub } from "./update.ts";
import { handleAdminAuth } from "./adminAuth.ts";
import { handleTestAccounts } from "./testAccounts.ts";
import { handleTestInbounds } from "./testInbounds.ts";
import { handleInstall, handleAttachDomain, handleDetectPanel } from "./install.ts";
import { contentType } from "https://deno.land/std@0.224.0/media_types/mod.ts";
import { extname, join, normalize } from "https://deno.land/std@0.224.0/path/mod.ts";

const PORT = Number(Deno.env.get("PORT") ?? 8080);
const STATIC_DIR = (() => {
  const raw = Deno.env.get("STATIC_DIR") ?? "./dist";
  try { return Deno.realPathSync(raw); } catch { return raw; }
})();

// Origin whitelist for sensitive endpoints (REST + admin-auth).
// PUBLIC_URL=https://example.com  → only that origin gets CORS approval.
// CORS_ORIGINS=a,b,c              → additional comma-separated origins.
// Empty (dev) → falls back to "*".
const ORIGIN_WHITELIST: string[] = (() => {
  const list = new Set<string>();
  const pu = Deno.env.get("PUBLIC_URL")?.trim();
  if (pu) list.add(pu.replace(/\/+$/, ""));
  const extra = Deno.env.get("CORS_ORIGINS")?.trim() ?? "";
  for (const o of extra.split(",").map((s) => s.trim()).filter(Boolean)) {
    list.add(o.replace(/\/+$/, ""));
  }
  return [...list];
})();

function pickOrigin(req: Request): string {
  const reqOrigin = req.headers.get("origin")?.replace(/\/+$/, "") ?? "";
  if (!ORIGIN_WHITELIST.length) return "*";
  if (reqOrigin && ORIGIN_WHITELIST.includes(reqOrigin)) return reqOrigin;
  return ORIGIN_WHITELIST[0]; // fallback — browser will block mismatched origins
}

function corsFor(req: Request, strict = false): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": strict ? pickOrigin(req) : "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer, range, x-supabase-api-version, x-admin-token",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS, HEAD",
    "Access-Control-Expose-Headers": "content-range, content-profile",
    "Vary": "Origin",
  };
}

// Loose CORS for static / public sub endpoints.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer, range, x-supabase-api-version, x-admin-token",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS, HEAD",
  "Access-Control-Expose-Headers": "content-range, content-profile",
};

async function serveStatic(url: URL): Promise<Response> {
  let p = decodeURIComponent(url.pathname);
  if (p === "/" || p === "") p = "/index.html";
  // Normalize and resolve to absolute path, then verify it stays inside STATIC_DIR.
  const filePath = join(STATIC_DIR, normalize(p));
  let realPath: string;
  try {
    realPath = await Deno.realPath(filePath);
  } catch {
    // File doesn't exist — SPA fallback.
    try {
      const html = await Deno.readFile(join(STATIC_DIR, "index.html"));
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }
  // Prevent path traversal: resolved path must be inside STATIC_DIR.
  const staticPrefix = STATIC_DIR.endsWith("/") ? STATIC_DIR : STATIC_DIR + "/";
  if (!realPath.startsWith(staticPrefix) && realPath !== STATIC_DIR) {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    const file = await Deno.readFile(realPath);
    const ct = contentType(extname(realPath)) ?? "application/octet-stream";
    return new Response(file, { headers: { "content-type": ct, "cache-control": "public, max-age=300" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

function withStrictCors(req: Request, res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsFor(req, true))) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") {
    // Strict CORS preflight for sensitive endpoints, loose for the rest.
    const strict = url.pathname.startsWith("/rest/v1/") ||
                   url.pathname.startsWith("/functions/v1/admin-auth") ||
                   url.pathname.startsWith("/functions/v1/panel") ||
                   url.pathname.startsWith("/api/update") ||
                   url.pathname.startsWith("/api/test-accounts") ||
                   url.pathname.startsWith("/api/test-inbounds");
    return new Response("ok", { headers: strict ? corsFor(req, true) : cors });
  }

  if (url.pathname === "/api/health") {
    return new Response(JSON.stringify({ ok: true, ts: new Date().toISOString() }), {
      headers: { ...cors, "content-type": "application/json" },
    });
  }

  // Subscription endpoint — must be reachable both as /sub/<slug> and /functions/v1/sub/<slug>
  if (url.pathname.startsWith("/sub/") || url.pathname.startsWith("/functions/v1/sub")) {
    return withCors(await handleSub(req, url));
  }
  if (url.pathname.startsWith("/functions/v1/panel")) {
    return withStrictCors(req, await handlePanel(req, url));
  }
  if (url.pathname.startsWith("/functions/v1/admin-auth")) {
    return withStrictCors(req, await handleAdminAuth(req));
  }
  if (url.pathname.startsWith("/rest/v1/")) {
    return withStrictCors(req, await handleRest(req, url));
  }
  if (url.pathname === "/api/update" || url.pathname === "/api/update/") {
    return withStrictCors(req, await handleUpdate(req, url));
  }
  if (url.pathname === "/api/install-panel" || url.pathname === "/api/install-panel/") {
    return withStrictCors(req, await handleInstall(req, url));
  }
  if (url.pathname === "/api/attach-domain" || url.pathname === "/api/attach-domain/") {
    return withStrictCors(req, await handleAttachDomain(req, url));
  }
  if (url.pathname === "/api/detect-panel" || url.pathname === "/api/detect-panel/") {
    return withStrictCors(req, await handleDetectPanel(req, url));
  }
  if (url.pathname === "/api/version" || url.pathname === "/api/version/") {
    return withCors(await handleVersion(req));
  }
  if (url.pathname === "/api/update-from-github" || url.pathname === "/api/update-from-github/") {
    return withCors(await handleUpdateFromGithub(req, url));
  }
  if (url.pathname === "/api/test-accounts" || url.pathname === "/api/test-accounts/") {
    return withStrictCors(req, await handleTestAccounts(req));
  }
  if (url.pathname === "/api/test-inbounds" || url.pathname === "/api/test-inbounds/") {
    return withStrictCors(req, await handleTestInbounds(req));
  }
  // Stub auth endpoints so supabase-js doesn't error if it tries to refresh tokens.
  if (url.pathname.startsWith("/auth/v1/")) {
    console.debug(`[auth-stub] ${req.method} ${url.pathname} → 200 {}`);
    return new Response(JSON.stringify({}), { status: 200, headers: { ...cors, "content-type": "application/json" } });
  }

  // Any unknown /api/* or /functions/* path gets a hard 404 — not the SPA fallback.
  // This prevents a missing route from silently returning index.html with a 200.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/functions/")) {
    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { ...cors, "content-type": "application/json" },
    });
  }

  return await serveStatic(url);
});

console.log(`✓ 3X-UI Sub Manager listening on :${PORT}`);