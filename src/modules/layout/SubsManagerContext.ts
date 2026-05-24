import { useOutletContext } from "react-router-dom";
import type { useSubsManager } from "@/modules/subs/useSubsManager";
import type { AppLog } from "@/modules/shared/types";

export type SubsManagerCtx = {
  m: ReturnType<typeof useSubsManager>;
  appLogs: AppLog[];
  setAppLogs: (logs: AppLog[]) => void;
};

export function useSubsCtx(): SubsManagerCtx {
  return useOutletContext<SubsManagerCtx>();
}