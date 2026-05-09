import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { checkSession, clearAdminToken, getAdminToken } from "@/lib/adminAuth";

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "ok" | "deny">("checking");
  const loc = useLocation();

  useEffect(() => {
    const t = getAdminToken();
    if (!t) { setState("deny"); return; }
    let cancelled = false;
    checkSession(t)
      .then((r) => {
        if (cancelled) return;
        if (r?.valid) setState("ok");
        else { clearAdminToken(); setState("deny"); }
      })
      .catch(() => { if (!cancelled) { clearAdminToken(); setState("deny"); } });
    return () => { cancelled = true; };
  }, []);

  if (state === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (state === "deny") return <Navigate to="/login" replace state={{ from: loc }} />;
  return <>{children}</>;
}