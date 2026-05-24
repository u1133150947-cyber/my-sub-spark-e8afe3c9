import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubsTab } from "@/modules/subs/SubsTab";
import { useSubsCtx } from "@/modules/layout/SubsManagerContext";
import { fmtExpire, fmtGB } from "@/modules/shared/utils";

export default function SubsListPage() {
  const { m } = useSubsCtx();
  const [params, setParams] = useSearchParams();

  // Pick up ?q= from URL (e.g. via TopBar search) once on mount/param change.
  useEffect(() => {
    const q = params.get("q");
    if (q != null && q !== m.subsSearch) m.setSubsSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const exportCsv = () => {
    const header = ["name", "slug", "client_email", "expiry", "limit", "hits", "created_at"];
    const rows = m.subs.map((s) => [
      s.name,
      s.slug,
      s.client_email,
      fmtExpire(s.expiry_ms),
      fmtGB(s.total_bytes),
      String(s.hits ?? 0),
      s.created_at,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `subs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={m.subs.length === 0}>
          <Download className="size-4 mr-1.5" />
          Экспорт CSV ({m.subs.length})
        </Button>
      </div>
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
    </div>
  );
}