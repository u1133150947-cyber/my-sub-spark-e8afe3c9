import { useEffect } from "react";
import { LogsTab } from "@/modules/serverLogs/LogsTab";
import { useSubsCtx } from "@/modules/layout/SubsManagerContext";

export default function ServerLogsPage() {
  const { appLogs, setAppLogs } = useSubsCtx();

  useEffect(() => {
    try {
      localStorage.setItem("logs_last_seen", String(Date.now()));
    } catch {}
  }, []);

  return <LogsTab appLogs={appLogs} setAppLogs={setAppLogs} active={true} />;
}