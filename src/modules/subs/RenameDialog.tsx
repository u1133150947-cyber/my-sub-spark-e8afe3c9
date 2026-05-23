import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { COUNTRIES, countryByCode, buildDisplay } from "@/modules/shared/constants";

interface Props {
  renameTarget: { panel: string; inboundId: number; original: string } | null;
  setRenameTarget: (v: { panel: string; inboundId: number; original: string } | null) => void;
  renameCountry: string;
  setRenameCountry: (v: string) => void;
  renameLabel: string;
  setRenameLabel: (v: string) => void;
  renameSaving: boolean;
  saveRename: () => void;
}

export function RenameDialog(props: Props) {
  const { renameTarget, setRenameTarget, renameCountry, setRenameCountry, renameLabel, setRenameLabel, renameSaving, saveRename } = props;
  return (
    <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Переименовать подключение</DialogTitle>
          <DialogDescription>Задайте флаг страны и название, которое увидят клиенты.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Это название увидят клиенты в приложении (Happ и др.). Имя панели — только для навигации внутри админки.
            Оригинальное имя на панели: <code>{renameTarget?.original}</code>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Флаг страны (только иконка)</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-start">
                  {renameCountry
                    ? `${countryByCode(renameCountry)?.flag} ${countryByCode(renameCountry)?.name}`
                    : "🏳️ Без страны"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto w-72">
                <DropdownMenuItem onClick={() => setRenameCountry("")}>
                  <span className="text-lg mr-2">🏳️</span><span>Без страны</span>
                </DropdownMenuItem>
                {COUNTRIES.map((c) => (
                  <DropdownMenuItem key={c.code} onClick={() => setRenameCountry(c.code)}>
                    <span className="text-lg mr-2">{c.flag}</span>
                    <span>{c.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{c.code}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Подпись (что показать клиенту)</Label>
            <Input
              value={renameLabel}
              onChange={(e) => setRenameLabel(e.target.value)}
              placeholder="YouTube без рекламы"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") saveRename(); }}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Превью: <code>{buildDisplay(renameCountry, renameLabel) || "— пусто —"}</code>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Оставь оба поля пустыми, чтобы сбросить переименование.
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setRenameTarget(null)} disabled={renameSaving}>Отмена</Button>
          <Button onClick={saveRename} disabled={renameSaving}
            style={{ background: "var(--gradient-hero)", color: "hsl(var(--primary-foreground))" }}>
            {renameSaving ? <Loader2 className="size-4 animate-spin" /> : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}