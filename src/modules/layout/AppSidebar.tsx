import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LogOut, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { APP_LOGS, APP_LOG_LISTENERS } from "@/modules/shared/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NAV_CONFIG } from "./navConfig";

const LOGS_SEEN_KEY = "logs_last_seen_ts";

function useUnreadErrors() {
  const { pathname } = useLocation();
  const [count, setCount] = useState(0);

  const recompute = () => {
    let lastSeen = 0;
    try { lastSeen = Number(localStorage.getItem(LOGS_SEEN_KEY) ?? "0"); } catch {}
    setCount(APP_LOGS.filter((l) => l.level === "error" && l.ts > lastSeen).length);
  };

  useEffect(() => {
    recompute();
    APP_LOG_LISTENERS.add(recompute);
    return () => { APP_LOG_LISTENERS.delete(recompute); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mark as read whenever user opens the logs page.
  useEffect(() => {
    if (pathname === "/logs" || pathname.startsWith("/logs/")) {
      try { localStorage.setItem(LOGS_SEEN_KEY, String(Date.now())); } catch {}
      setCount(0);
    }
  }, [pathname]);

  return count;
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const unreadErrors = useUnreadErrors();

  const isActive = (href: string) =>
    href === "/subs"
      ? pathname === "/subs"
      : pathname === href || pathname.startsWith(href + "/");

  const handleLogout = () => {
    try {
      localStorage.removeItem("admin_session");
    } catch {}
    window.location.href = "/login";
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div
            className="size-8 shrink-0 rounded-lg flex items-center justify-center"
            style={{ background: "var(--gradient-hero)" }}
          >
            <Zap className="size-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-sm">Sub Manager</span>
              <span className="text-xs text-muted-foreground">Admin Panel</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_CONFIG.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={item.label}
                    >
                      <NavLink to={item.href} className="flex items-center gap-2">
                        <item.icon className="size-4" />
                        <span className="flex-1">{item.label}</span>
                        {item.id === "logs" && unreadErrors > 0 && !collapsed && (
                          <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                            {unreadErrors > 99 ? "99+" : unreadErrors}
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip="Выход"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="size-4" />
              <span>Выход</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}