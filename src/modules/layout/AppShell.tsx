import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppTopBar } from "./AppTopBar";
import { RenameDialog } from "@/modules/subs/RenameDialog";
import { useSubsManager } from "@/modules/subs/useSubsManager";
import type { AppLog } from "@/modules/shared/types";
import { APP_LOGS, APP_LOG_LISTENERS } from "@/modules/shared/utils";
import type { SubsManagerCtx } from "./SubsManagerContext";

export default function AppShell() {
  const navigate = useNavigate();
  const m = useSubsManager({ onNavigateToSubs: () => navigate("/subs") });

  const [appLogs, setAppLogs] = useState<AppLog[]>(APP_LOGS.slice());
  useEffect(() => {
    const fn = () => setAppLogs(APP_LOGS.slice());
    APP_LOG_LISTENERS.add(fn);
    return () => {
      APP_LOG_LISTENERS.delete(fn);
    };
  }, []);

  const ctx: SubsManagerCtx = { m, appLogs, setAppLogs };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppTopBar />
          <main className="flex-1 p-4 md:p-6">
            <Outlet context={ctx} />
          </main>
        </div>
      </div>

      <RenameDialog
        renameTarget={m.renameTarget}
        setRenameTarget={m.setRenameTarget}
        renameCountry={m.renameCountry}
        setRenameCountry={m.setRenameCountry}
        renameLabel={m.renameLabel}
        setRenameLabel={m.setRenameLabel}
        renameSaving={m.renameSaving}
        saveRename={m.saveRename}
      />
    </SidebarProvider>
  );
}