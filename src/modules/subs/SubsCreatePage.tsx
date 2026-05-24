import { useEffect } from "react";
import { CreateTab } from "@/modules/subs/CreateTab";
import { useSubsCtx } from "@/modules/layout/SubsManagerContext";

export default function SubsCreatePage() {
  const { m } = useSubsCtx();

  useEffect(() => {
    m.loadInbounds();
    m.loadEmailMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <CreateTab
      inbounds={m.inbounds}
      loadingInbounds={m.loadingInbounds}
      loadInbounds={m.loadInbounds}
      panelMeta={m.panelMeta}
      panelLabel={m.panelLabel}
      inboundLabel={m.inboundLabel}
      overrides={m.overrides}
      name={m.name}
      setName={m.setName}
      days={m.days}
      setDays={m.setDays}
      totalGB={m.totalGB}
      setTotalGB={m.setTotalGB}
      selected={m.selected}
      setSelected={m.setSelected}
      toggle={m.toggle}
      applyPreset={m.applyPreset}
      creating={m.creating}
      create={m.create}
      bulkBusy={m.bulkBusy}
      bulkAdd={m.bulkAdd}
      bulkRemove={m.bulkRemove}
      openRename={m.openRename}
    />
  );
}