import { PanelsManager } from "@/components/PanelsManager";
import { useSubsCtx } from "@/modules/layout/SubsManagerContext";

export default function PanelsListPage() {
  const { m } = useSubsCtx();
  return <PanelsManager onChanged={m.loadInbounds} />;
}