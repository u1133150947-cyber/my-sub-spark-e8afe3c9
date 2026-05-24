import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    navigate(v ? `/subs?q=${encodeURIComponent(v)}` : "/subs");
  };

  return (
    <header className="h-14 flex items-center gap-2 border-b border-border bg-background px-4 sticky top-0 z-30">
      <SidebarTrigger />

      <form onSubmit={submit} className="flex-1 max-w-md ml-2">
        <div className="relative">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск подписок: имя, email, slug…"
            className="pl-8 h-9"
          />
        </div>
      </form>

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