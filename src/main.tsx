import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { getAdminToken } from "./lib/adminAuth";

// Global fetch interceptor: attach x-admin-token to any request that hits
// our backend admin-protected endpoints. Without this, panel/sub/update
// calls return 401 from the self-hosted server (server/auth.ts) because
// supabase.functions.invoke doesn't know about our admin session token.
if (typeof window !== "undefined" && !(window as any).__adminFetchPatched) {
  (window as any).__adminFetchPatched = true;
  const origFetch = window.fetch.bind(window);
  const ADMIN_PATHS = ["/functions/v1/panel", "/functions/v1/sub", "/functions/v1/admin-auth", "/api/update"];
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      if (url && ADMIN_PATHS.some((p) => url.includes(p))) {
        const token = getAdminToken();
        if (token) {
          const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
          if (!headers.has("x-admin-token")) headers.set("x-admin-token", token);
          init = { ...(init ?? {}), headers };
        }
      }
    } catch { /* noop */ }
    return origFetch(input as any, init);
  };
}

createRoot(document.getElementById("root")!).render(<App />);
