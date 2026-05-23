import { QRCodeSVG } from "qrcode.react";
import { Copy, Trash2, Link2, Loader2, Server, Pencil, X, Check, Search, ArrowUpDown, Eye, ArrowUp, ArrowDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { InboundInfo, InboundsResp, PanelMeta, Subscription } from "@/modules/shared/types";
import { subUrl, happUrl } from "@/modules/shared/constants";
import { fmtExpire, fmtGB } from "@/modules/shared/utils";

interface Props {
  subs: Subscription[];
  subsSearch: string;
  setSubsSearch: (v: string) => void;
  subsSort: string;
  setSubsSort: (v: string) => void;
  subsSelected: Set<string>;
  setSubsSelected: (v: Set<string>) => void;
  bulkDeleting: boolean;
  bulkDeleteSubs: () => void;

  inbounds: InboundsResp | null;
  panelMeta: PanelMeta[];
  panelLabel: (slug: string) => string;
  inboundLabel: (panel: string, id: number, fallback: string) => string;

  activeQr: string | null;
  setActiveQr: (v: string | null) => void;
  editingId: string | null;
  openEdit: (s: Subscription) => Promise<void> | void;
  closeEdit: () => void;
  remove: (id: string) => void;
  copy: (text: string) => void;

  editName: string;
  setEditName: (v: string) => void;
  editDays: string;
  setEditDays: (v: string) => void;
  editGB: string;
  setEditGB: (v: string) => void;
  editSelected: Set<string>;
  setEditSelected: (v: Set<string>) => void;
  editExisting: Set<string>;
  editOrder: string[];
  setEditOrder: (v: string[] | ((prev: string[]) => string[])) => void;
  editExternals: Record<string, { name: string; emoji: string; raw_links: string[]; sort_order: number }>;
  toggleEdit: (key: string) => void;
  moveOrder: (key: string, dir: -1 | 1) => void;
  savingEdit: boolean;
  saveEdit: (s: Subscription) => void;
  saveOrder: (s: Subscription) => void;

  expiryStatus: (s: Subscription) => { label: string; tone: "muted" | "warn" | "danger" };
}

export function SubsTab(props: Props) {
  const {
    subs, subsSearch, setSubsSearch, subsSort, setSubsSort, subsSelected, setSubsSelected,
    bulkDeleting, bulkDeleteSubs,
    inbounds, panelMeta, panelLabel, inboundLabel,
    activeQr, setActiveQr, editingId, openEdit, closeEdit, remove, copy,
    editName, setEditName, editDays, setEditDays, editGB, setEditGB,
    editSelected, setEditSelected, editExisting, editOrder, setEditOrder, editExternals,
    toggleEdit, moveOrder, savingEdit, saveEdit, saveOrder, expiryStatus,
  } = props;

  return (
    <section>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Подписки ({subs.length})</h2>
        <div className="flex gap-2"></div>
      </div>
      {subs.length > 0 && (
        <Card className="p-3 mb-3 border-border flex flex-wrap items-center gap-2" style={{ background: "var(--gradient-card)" }}>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={subsSearch}
              onChange={(e) => setSubsSearch(e.target.value)}
              placeholder="Поиск по имени, email или slug…"
              className="pl-8 h-9"
            />
          </div>
          <Select value={subsSort} onValueChange={setSubsSort}>
            <SelectTrigger className="w-[200px] h-9">
              <ArrowUpDown className="size-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_desc">Сначала новые</SelectItem>
              <SelectItem value="created_asc">Сначала старые</SelectItem>
              <SelectItem value="name_asc">Имя ↑ (A→Я)</SelectItem>
              <SelectItem value="name_desc">Имя ↓ (Я→A)</SelectItem>
              <SelectItem value="hits_desc">Больше hits</SelectItem>
              <SelectItem value="hits_asc">Меньше hits</SelectItem>
              <SelectItem value="expiry_asc">Скоро истекают</SelectItem>
              <SelectItem value="expiry_desc">Позже истекают</SelectItem>
              <SelectItem value="traffic_desc">Больше трафика</SelectItem>
            </SelectContent>
          </Select>
          {(() => {
            const visible = subs.filter((s) => {
              const q = subsSearch.trim().toLowerCase();
              if (!q) return true;
              return s.name.toLowerCase().includes(q) || s.client_email.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q);
            });
            const allSelected = visible.length > 0 && visible.every((s) => subsSelected.has(s.id));
            return (
              <label className="flex items-center gap-2 text-sm cursor-pointer px-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) => {
                    const next = new Set(subsSelected);
                    if (v) visible.forEach((s) => next.add(s.id));
                    else visible.forEach((s) => next.delete(s.id));
                    setSubsSelected(next);
                  }}
                />
                Выбрать все ({visible.length})
              </label>
            );
          })()}
          {subsSelected.size > 0 && (
            <>
              <span className="text-xs text-muted-foreground">Выбрано: {subsSelected.size}</span>
              <Button variant="outline" size="sm" onClick={() => setSubsSelected(new Set())}>
                Сбросить
              </Button>
              <Button variant="destructive" size="sm" onClick={bulkDeleteSubs} disabled={bulkDeleting}>
                {bulkDeleting ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Trash2 className="size-3.5 mr-1" />}
                Удалить выбранные
              </Button>
            </>
          )}
        </Card>
      )}
      {subs.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground border-dashed">
          Подписок пока нет.
        </Card>
      ) : (
        <div className="grid gap-3">
          {(() => {
            const q = subsSearch.trim().toLowerCase();
            const filtered = subs.filter((s) =>
              !q || s.name.toLowerCase().includes(q) || s.client_email.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q)
            );
            const sorted = [...filtered].sort((a, b) => {
              switch (subsSort) {
                case "created_asc": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                case "name_asc": return a.name.localeCompare(b.name, "ru");
                case "name_desc": return b.name.localeCompare(a.name, "ru");
                case "hits_desc": return b.hits - a.hits;
                case "hits_asc": return a.hits - b.hits;
                case "expiry_asc": return (a.expiry_ms || Infinity) - (b.expiry_ms || Infinity);
                case "expiry_desc": return (b.expiry_ms || 0) - (a.expiry_ms || 0);
                case "traffic_desc": return b.total_bytes - a.total_bytes;
                default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              }
            });
            if (sorted.length === 0) {
              return <Card className="p-6 text-center text-muted-foreground border-dashed">Ничего не найдено</Card>;
            }
            return sorted.map((s) => {
              const url = subUrl(s.slug);
              const happ = happUrl(s.slug);
              const status = expiryStatus(s);
              return (
                <Card key={s.id} id={`sub-${s.id}`} className="p-4 border-border" style={{ background: "var(--gradient-card)" }}>
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <Checkbox
                      className="self-start md:self-center mt-1 md:mt-0"
                      checked={subsSelected.has(s.id)}
                      onCheckedChange={(v) => {
                        const next = new Set(subsSelected);
                        if (v) next.add(s.id); else next.delete(s.id);
                        setSubsSelected(next);
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold truncate">{s.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                          {s.hits} hits
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            status.tone === "danger"
                              ? "bg-destructive/20 text-destructive"
                              : status.tone === "warn"
                              ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {status.tone === "muted" && s.expiry_ms ? `до ${fmtExpire(s.expiry_ms)}` : status.label}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                          {fmtGB(s.total_bytes)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Link2 className="size-3 shrink-0" />
                        <code className="truncate">{url}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          title="Изменить URL подписки"
                          onClick={async () => {
                            if (editingId !== s.id) await openEdit(s);
                            setTimeout(() => {
                              const el = document.querySelector(`#sub-${s.id} input[data-slug-input="1"]`) as HTMLInputElement | null;
                              if (el) { el.focus(); el.select(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
                            }, 50);
                          }}
                        >
                          <Pencil className="size-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="secondary" size="sm" onClick={() => copy(url)}>
                        <Copy className="size-3.5 mr-1" /> URL
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setActiveQr(activeQr === s.id ? null : s.id)}>
                        QR
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => editingId === s.id ? closeEdit() : openEdit(s)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(s.id)}>
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {activeQr === s.id && (
                    <div className="mt-4 flex flex-col items-center gap-2 p-4 rounded-lg bg-secondary">
                      <div className="bg-white p-3 rounded">
                        <QRCodeSVG value={happ} size={180} />
                      </div>
                      <p className="text-xs text-muted-foreground break-all text-center max-w-xs">{happ}</p>
                    </div>
                  )}
                  {editingId === s.id && (
                    <div className="mt-4 p-4 rounded-lg bg-secondary space-y-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Имя</Label>
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={64} />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Продлить (дней, 0 = безлимит)</Label>
                          <Input type="number" min={0} placeholder="не менять" value={editDays} onChange={(e) => setEditDays(e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Трафик GB (0 = безлимит)</Label>
                          <Input type="number" min={0} placeholder="не менять" value={editGB} onChange={(e) => setEditGB(e.target.value)} />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground mb-2 block">Подключения</Label>
                        <div className="grid gap-3 md:grid-cols-2">
                          {panelMeta.map(({ slug: panel }) => {
                            const list = inbounds?.[panel] as InboundInfo[] | { error: string } | undefined;
                            return (
                              <Card key={panel} className="p-3 bg-background border-border">
                                <div className="flex items-center justify-between mb-2 text-sm font-semibold">
                                  <div className="flex items-center gap-2">
                                    <Server className="size-3.5 text-primary" />
                                    {panelLabel(panel)}
                                  </div>
                                  {Array.isArray(list) && list.length > 0 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 px-2 text-[10px] text-muted-foreground"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        const next = new Set(editSelected);
                                        const allKeys = list.map(ib => `${panel}:${ib.id}`);
                                        const allSelected = allKeys.every(k => next.has(k));
                                        if (allSelected) {
                                          allKeys.forEach(k => next.delete(k));
                                        } else {
                                          allKeys.forEach(k => next.add(k));
                                          setEditOrder(prev => Array.from(new Set([...prev, ...allKeys])));
                                        }
                                        setEditSelected(next);
                                      }}
                                    >
                                      {list.map(ib => `${panel}:${ib.id}`).every(k => editSelected.has(k)) ? "Снять все" : "Выбрать все"}
                                    </Button>
                                  )}
                                </div>
                                {Array.isArray(list) && list.length > 0 ? (
                                  <div className="space-y-2">
                                    {list.map((ib) => {
                                      const key = `${panel}:${ib.id}`;
                                      return (
                                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                                          <Checkbox checked={editSelected.has(key)} onCheckedChange={() => toggleEdit(key)} />
                                          <div className="flex-1 min-w-0">
                                            <div className="text-sm truncate">
                                              {inboundLabel(panel, ib.id, ib.remark)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              {ib.protocol.toUpperCase()} · :{ib.port}
                                            </div>
                                          </div>
                                        </label>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-xs text-muted-foreground">Нет inbound'ов</div>
                                )}
                              </Card>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                          <Eye className="size-3.5" /> Как увидит клиент в приложении (порядок ↕)
                        </Label>
                        <Card className="p-3 bg-background border-border">
                          {(() => {
                            const visible = editOrder.filter((k) => editSelected.has(k));
                            if (!visible.length) {
                              return <div className="text-xs text-muted-foreground">Нет выбранных подключений</div>;
                            }
                            const findIb = (key: string) => {
                              if (key.startsWith("ext:")) {
                                const extId = key.slice(4);
                                const e = editExternals[extId];
                                return {
                                  panel: "ext",
                                  id: 0,
                                  remark: e ? `${e.emoji} ${e.name} · ${e.raw_links.length} серв.` : "Сторонняя подписка",
                                  isExt: true,
                                };
                              }
                              const [panel, idStr] = key.split(":");
                              const list = inbounds?.[panel] as InboundInfo[] | { error: string } | undefined;
                              if (!Array.isArray(list)) return { panel, id: Number(idStr), remark: `#${idStr}`, isExt: false };
                              const ib = list.find((x) => x.id === Number(idStr));
                              return { panel, id: Number(idStr), remark: ib?.remark ?? `#${idStr}`, isExt: false };
                            };
                            return (
                              <div className="space-y-1">
                                {visible.map((key, idx) => {
                                  const { panel, id, remark, isExt } = findIb(key);
                                  return (
                                    <div key={key} className="flex items-center gap-2 px-2 py-1.5 rounded bg-secondary/40">
                                      <span className="text-xs text-muted-foreground w-5 text-right tabular-nums">{idx + 1}.</span>
                                      <div className="flex-1 min-w-0 text-sm truncate">
                                        {isExt ? remark : inboundLabel(panel, id, remark)}
                                      </div>
                                      <Button variant="ghost" size="icon" className="size-7" disabled={idx === 0}
                                        onClick={() => moveOrder(key, -1)}>
                                        <ArrowUp className="size-3.5" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="size-7" disabled={idx === visible.length - 1}
                                        onClick={() => moveOrder(key, 1)}>
                                        <ArrowDown className="size-3.5" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive"
                                        title="Удалить inbound (применится при Сохранить)"
                                        onClick={() => toggleEdit(key)}>
                                        <Trash2 className="size-3.5" />
                                      </Button>
                                    </div>
                                  );
                                })}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                                  {(() => {
                                    const totalAvail = panelMeta.reduce((sum, { slug: panel }) => {
                                      const list = inbounds?.[panel] as InboundInfo[] | { error: string } | undefined;
                                      return sum + (Array.isArray(list) ? list.filter((ib) => !editSelected.has(`${panel}:${ib.id}`)).length : 0);
                                    }, 0);
                                    return (
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button variant="outline" size="sm" className="h-8 text-xs">
                                            <Plus className="size-3.5 mr-1" />
                                            Добавить inbound {totalAvail > 0 ? `(${totalAvail})` : ""}
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[420px] max-h-[60vh] overflow-y-auto p-3" align="start">
                                          <div className="text-xs text-muted-foreground mb-2">Отметьте, какие inbound'ы должны быть у клиента. Применится при «Сохранить».</div>
                                          <div className="space-y-3">
                                            {panelMeta.map(({ slug: panel }) => {
                                              const list = inbounds?.[panel] as InboundInfo[] | { error: string } | undefined;
                                              return (
                                                <div key={panel}>
                                                  <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold">
                                                    <Server className="size-3 text-primary" />
                                                    {panelLabel(panel)}
                                                    {!Array.isArray(list) && (
                                                      <span className="text-destructive font-normal">
                                                        {list && "error" in list ? `· ${list.error}` : "· загрузка..."}
                                                      </span>
                                                    )}
                                                  </div>
                                                  {Array.isArray(list) && list.length > 0 ? (
                                                    <div className="space-y-1 pl-1">
                                                      {list.map((ib) => {
                                                        const k = `${panel}:${ib.id}`;
                                                        const checked = editSelected.has(k);
                                                        return (
                                                          <label key={k} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-secondary/40 rounded px-1.5 py-1">
                                                            <Checkbox checked={checked} onCheckedChange={() => toggleEdit(k)} />
                                                            <span className="flex-1 truncate">{inboundLabel(panel, ib.id, ib.remark)}</span>
                                                            <span className="text-[10px] text-muted-foreground uppercase">{ib.protocol}:{ib.port}</span>
                                                          </label>
                                                        );
                                                      })}
                                                    </div>
                                                  ) : Array.isArray(list) ? (
                                                    <div className="text-xs text-muted-foreground pl-1">Нет inbound'ов</div>
                                                  ) : null}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                    );
                                  })()}
                                  <Button variant="outline" size="sm" onClick={() => saveOrder(s)}>
                                    <Check className="size-3.5 mr-1" /> Сохранить порядок
                                  </Button>
                                </div>
                              </div>
                            );
                          })()}
                        </Card>
                      </div>

                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={closeEdit} disabled={savingEdit}>
                          <X className="size-4 mr-1" /> Отмена
                        </Button>
                        <Button size="sm" onClick={() => saveEdit(s)} disabled={savingEdit}
                          style={{ background: "var(--gradient-hero)", color: "hsl(var(--primary-foreground))" }}>
                          {savingEdit ? <Loader2 className="size-4 animate-spin" /> : (<><Check className="size-4 mr-1" />Сохранить</>)}
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            });
          })()}
        </div>
      )}
    </section>
  );
}