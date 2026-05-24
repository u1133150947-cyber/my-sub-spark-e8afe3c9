import { Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { OnlineClients } from "@/components/OnlineClients";

export function AppTopBar() {
  return (
    <header className="h-14 flex items-center gap-2 border-b border-border bg-background px-4 sticky top-0 z-30">
      <SidebarTrigger />

      <div className="ml-auto flex items-center gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <Wifi className="size-4" />
              <span className="hidden sm:inline">Онлайн</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Клиенты онлайн</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <OnlineClients />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}