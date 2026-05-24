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
  const ADMIN_PATHS = ["/functions/v1/panel", "/functions/v1/sub", "/api/update", "/api/install-panel", "/rest/v1/"];
  const SUPABASE_HOST = (() => {
    try { return new URL(import.meta.env.VITE_SUPABASE_URL as string).host; } catch { return ""; }
  })();
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      let urlStr = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      const isLovable = /lovable(?:project)?\.(app|dev|com)$/i.test(window.location.hostname) || window.location.hostname === "localhost";
      
      let finalInput = input;
      if (!isLovable && SUPABASE_HOST && urlStr.includes(SUPABASE_HOST)) {
        urlStr = urlStr.replace(`https://${SUPABASE_HOST}`, window.location.origin);
        if (input instanceof Request) {
          finalInput = new Request(urlStr, input);
        } else {
          finalInput = urlStr;
        }
      }

      // Skip Supabase-hosted endpoints — their CORS doesn't allow x-admin-token
      // and they don't need it. Only self-hosted VDS endpoints check it.
      const isSupabase = !!SUPABASE_HOST && urlStr.includes(SUPABASE_HOST);
      if (urlStr && !isSupabase && ADMIN_PATHS.some((p) => urlStr.includes(p))) {
        const token = getAdminToken();
        if (token) {
          const headers = new Headers(init?.headers ?? (finalInput instanceof Request ? finalInput.headers : undefined));
          if (!headers.has("x-admin-token")) headers.set("x-admin-token", token);
          init = { ...(init ?? {}), headers };
        }
      }
      return origFetch(finalInput as any, init);
    } catch { /* noop */ }
    return origFetch(input as any, init);
  };
}

createRoot(document.getElementById("root")!).render(<App />);
