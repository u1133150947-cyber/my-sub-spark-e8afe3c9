import { useEffect, useState } from "react";
import { StatsDashboard } from "@/components/StatsDashboard";
import { PanelsManager } from "@/components/PanelsManager";
import { UpdatePanel } from "@/components/UpdatePanel";
import { LogsTab } from "@/modules/logs/LogsTab";
import { CreateTab } from "@/modules/subs/CreateTab";
import { SubsTab } from "@/modules/subs/SubsTab";
import { RenameDialog } from "@/modules/subs/RenameDialog";
import { AppHeader } from "@/modules/layout/AppHeader";
import { useSubsManager } from "@/modules/subs/useSubsManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AppLog } from "@/modules/shared/types";
import { APP_LOGS, APP_LOG_LISTENERS } from "@/modules/shared/utils";

const Index = () => {
  const [activeTab, setActiveTab] = useState<string>("subs");
  const m = useSubsManager({ onNavigateToSubs: () => setActiveTab("subs") });

  const [appLogs, setAppLogs] = useState<AppLog[]>(APP_LOGS.slice());
  useEffect(() => {
    const fn = () => setAppLogs(APP_LOGS.slice());
    APP_LOG_LISTENERS.add(fn);
    return () => { APP_LOG_LISTENERS.delete(fn); };
  }, []);

  const [lastSeenLogTs, setLastSeenLogTs] = useState<number>(() => {
    try { return Number(localStorage.getItem("logs_last_seen") || "0"); } catch { return 0; }
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />

      <main className="container py-8">
        <Tabs value={activeTab} className="space-y-6" onValueChange={(v) => {
          setActiveTab(v);
          if (v === "create") { m.loadInbounds(); m.loadEmailMap(); }
        }}>
          <TabsList className="grid w-full max-w-5xl grid-cols-6">
            <TabsTrigger value="stats">📊 Статистика</TabsTrigger>
            <TabsTrigger value="create">➕ Новый</TabsTrigger>
            <TabsTrigger value="subs">🔑 Подписки</TabsTrigger>
            <TabsTrigger value="servers">🖥️ Панели</TabsTrigger>
            <TabsTrigger value="update">🔄 Обновление</TabsTrigger>
            <TabsTrigger value="logs" onClick={() => { const t = Date.now(); setLastSeenLogTs(t); localStorage.setItem("logs_last_seen", String(t)); }}>
              🪵 Логи{(() => {
                const unread = appLogs.filter((l) => l.level === "error" && l.ts > lastSeenLogTs).length;
                return unread ? ` (${unread})` : "";
              })()}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="mt-0">
            <StatsDashboard />
          </TabsContent>

          <TabsContent value="create" className="mt-0">
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
          </TabsContent>

          <TabsContent value="subs" className="mt-0">
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
          </TabsContent>

          <TabsContent value="servers" className="mt-0">
            <PanelsManager onChanged={m.loadInbounds} />
          </TabsContent>

          <TabsContent value="update" className="mt-0">
            <UpdatePanel />
          </TabsContent>

          <TabsContent value="logs" className="mt-0">
            <LogsTab appLogs={appLogs} setAppLogs={setAppLogs} active={activeTab === "logs"} />
          </TabsContent>
        </Tabs>
      </main>

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
    </div>
  );
};

export default Index;
