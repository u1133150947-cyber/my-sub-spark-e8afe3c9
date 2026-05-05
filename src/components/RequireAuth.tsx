import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TOKEN_KEY } from "@/pages/Login";
import { Loader2 } from "lucide-react";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "ok" | "no">("loading");

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setState("no");
      return;
    }
    supabase.functions
      .invoke("admin-auth?action=check", { method: "POST", body: { token } })
      .then(({ data, error }) => {
        if (error || !(data as any)?.ok) {
          localStorage.removeItem(TOKEN_KEY);
          setState("no");
        } else {
          setState("ok");
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setState("no");
      });
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (state === "no") return <Navigate to="/login" replace />;
  return <>{children}</>;
}