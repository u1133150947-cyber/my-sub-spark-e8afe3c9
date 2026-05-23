import { Zap, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { OnlineClients } from "@/components/OnlineClients";

export function AppHeader() {
  return (
    <header className="border-b border-border">
      <div className="container py-4 flex items-center gap-3">
        <div
          className="size-8 rounded-lg flex items-center justify-center"
          style={{ background: "var(--gradient-hero)" }}
        >
          <Zap className="size-4 text-primary-foreground" />
        </div>
        <span className="font-semibold">3X-UI Sub Manager</span>
        <div className="ml-auto">
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
      </div>
    </header>
  );
}