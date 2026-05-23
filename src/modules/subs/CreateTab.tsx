import { Plus, RefreshCw, Loader2, Server, MoreVertical, Pencil, UserPlus, UserMinus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { InboundInfo, InboundsResp, PanelKey, PanelMeta } from "@/modules/shared/types";
import { PRESETS } from "@/modules/shared/constants";

interface Props {
  inbounds: InboundsResp | null;
  loadingInbounds: boolean;
  loadInbounds: () => void;
  panelMeta: PanelMeta[];
  panelLabel: (slug: string) => string;
  inboundLabel: (panel: string, id: number, fallback: string) => string;
  overrides: Record<string, string>;
  name: string;
  setName: (v: string) => void;
  days: number;
  setDays: (v: number) => void;
  totalGB: number;
  setTotalGB: (v: number) => void;
  selected: Set<string>;
  setSelected: (v: Set<string>) => void;
  toggle: (key: string) => void;
  applyPreset: (p: { days: number; gb: number }) => void;
  creating: boolean;
  create: () => void;
  bulkBusy: string | null;
  bulkAdd: (panel: PanelKey, inboundId: number, remark: string) => void;
  bulkRemove: (panel: PanelKey, inboundId: number, remark: string) => void;
  openRename: (panel: string, inboundId: number, original: string) => void;
}

export function CreateTab(props: Props) {
  const {
    inbounds, loadingInbounds, loadInbounds, panelMeta, panelLabel, inboundLabel, overrides,
    name, setName, days, setDays, totalGB, setTotalGB,
    selected, setSelected, toggle, applyPreset, creating, create,
    bulkBusy, bulkAdd, bulkRemove, openRename,
  } = props;

  return (
    <Card className="p-6 border-border" style={{ background: "var(--gradient-card)" }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Plus className="size-4 text-primary" /> Новый клиент
        </h2>
        <Button variant="ghost" size="sm" onClick={loadInbounds} disabled={loadingInbounds}>
          <RefreshCw className={`size-4 mr-1 ${loadingInbounds ? "animate-spin" : ""}`} />
          Обновить
        </Button>
      </div>

      <div className="mb-4">
        <Label className="text-xs text-muted-foreground mb-2 block">Быстрые тарифы</Label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const active = days === p.days && totalGB === p.gb;
            return (
              <Button
                key={p.label}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => applyPreset(p)}
                style={active ? { background: "var(--gradient-hero)", color: "hsl(var(--primary-foreground))" } : undefined}
              >
                {p.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <div>
          <Label className="text-xs text-muted-foreground">Имя клиента</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иван" maxLength={64} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Срок (дней, 0 = безлимит)</Label>
          <Input type="number" min={0} value={days} onChange={(e) => setDays(parseInt(e.target.value || "0", 10))} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Трафик GB (0 = безлимит)</Label>
          <Input type="number" min={0} value={totalGB} onChange={(e) => setTotalGB(parseInt(e.target.value || "0", 10))} />
        </div>
      </div>

      <div className="mb-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground mb-1 block">Серверы для подписки</Label>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} className="h-6 px-2 text-xs">Снять все</Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-4">
        {panelMeta.map(({ slug: panel }) => {
          const list = inbounds?.[panel] as InboundInfo[] | { error: string } | undefined;
          const isList = Array.isArray(list);
          const items = isList ? (list as InboundInfo[]) : [];
          const allKeys = items.map((ib) => `${panel}:${ib.id}`);
          return (
            <div key={panel} className="space-y-2">
              <div className="font-semibold flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Server className="size-4 text-primary" />
                  {panelLabel(panel)}
                </div>
                {isList && items.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-2 text-[10px] text-muted-foreground"
                    onClick={(e) => {
                      e.preventDefault();
                      const next = new Set(selected);
                      const allSelected = allKeys.every(k => next.has(k));
                      if (allSelected) {
                        allKeys.forEach(k => next.delete(k));
                      } else {
                        allKeys.forEach(k => next.add(k));
                      }
                      setSelected(next);
                    }}
                  >
                    {allKeys.every(k => selected.has(k)) ? "Снять все" : "Выбрать все"}
                  </Button>
                )}
              </div>
              {!inbounds && <div className="text-sm text-muted-foreground">Загрузка...</div>}
              {list && "error" in (list as any) && (
                <div className="text-sm text-destructive">{(list as any).error}</div>
              )}
              {items.map((ib) => {
                const key = `${panel}:${ib.id}`;
                const busy = bulkBusy === `add:${key}` || bulkBusy === `rm:${key}`;
                return (
                  <div key={key} className="flex items-center gap-2 mb-2">
                    <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                      <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">
                          {inboundLabel(panel, ib.id, ib.remark)}
                          {overrides[`${panel}:${ib.id}`] && (
                            <span className="ml-2 text-[10px] uppercase text-muted-foreground" title={ib.remark}>↺ {ib.remark}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {ib.protocol.toUpperCase()} · :{ib.port}
                        </div>
                      </div>
                    </label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7 shrink-0" disabled={busy}>
                          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <MoreVertical className="size-3.5" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel className="text-xs">Действия</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openRename(panel, ib.id, ib.remark || `#${ib.id}`)}>
                          <Pencil className="size-3.5 mr-2 text-primary" /> Переименовать
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => bulkAdd(panel, ib.id, ib.remark || `#${ib.id}`)}>
                          <UserPlus className="size-3.5 mr-2 text-green-500" /> Добавить всем
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => bulkRemove(panel, ib.id, ib.remark || `#${ib.id}`)} className="text-destructive focus:text-destructive">
                          <UserMinus className="size-3.5 mr-2" /> Убрать у всех
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <Button
        onClick={create}
        disabled={creating}
        className="w-full font-semibold"
        style={{ background: "var(--gradient-hero)", color: "hsl(var(--primary-foreground))" }}
      >
        {creating ? <Loader2 className="size-4 animate-spin" /> : (
          <><Zap className="size-4 mr-1" /> Создать подписку</>
        )}
      </Button>
    </Card>
  );
}