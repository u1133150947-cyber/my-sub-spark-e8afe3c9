import { SubsTab } from "@/modules/subs/SubsTab";
import { useSubsCtx } from "@/modules/layout/SubsManagerContext";

export default function SubsListPage() {
  const { m } = useSubsCtx();
  return (
    <SubsTab
      subs={m.subs}
      subsSearch={m.subsSearch}
      setSubsSearch={m.setSubsSearch}
      subsSort={m.subsSort}
      setSubsSort={m.setSubsSort}
      subsSelected={m.subsSelected}
      setSubsSelected={m.setSubsSelected}
      bulkDeleting={m.bulkDeleting}
      bulkDeleteSubs={m.bulkDeleteSubs}
      inbounds={m.inbounds}
      panelMeta={m.panelMeta}
      panelLabel={m.panelLabel}
      inboundLabel={m.inboundLabel}
      activeQr={m.activeQr}
      setActiveQr={m.setActiveQr}
      editingId={m.editingId}
      openEdit={m.openEdit}
      closeEdit={m.closeEdit}
      remove={m.remove}
      copy={m.copy}
      editName={m.editName}
      setEditName={m.setEditName}
      editDays={m.editDays}
      setEditDays={m.setEditDays}
      editGB={m.editGB}
      setEditGB={m.setEditGB}
      editSelected={m.editSelected}
      setEditSelected={m.setEditSelected}
      editExisting={m.editExisting}
      editOrder={m.editOrder}
      setEditOrder={m.setEditOrder}
      editExternals={m.editExternals}
      toggleEdit={m.toggleEdit}
      moveOrder={m.moveOrder}
      savingEdit={m.savingEdit}
      saveEdit={m.saveEdit}
      saveOrder={m.saveOrder}
      expiryStatus={m.expiryStatus}
    />
  );
}