import {
  LayoutDashboard,
  Plus,
  Key,
  Server,
  Rocket,
  RefreshCw,
  Terminal,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_CONFIG: NavSection[] = [
  {
    title: "Дашборд",
    items: [
      { id: "stats", label: "Статистика", icon: LayoutDashboard, href: "/dashboard" },
    ],
  },
  {
    title: "Подписки",
    items: [
      { id: "subs", label: "Список", icon: Key, href: "/subs" },
      { id: "create", label: "Новая", icon: Plus, href: "/subs/create" },
    ],
  },
  {
    title: "Инфраструктура",
    items: [
      { id: "panels", label: "Панели", icon: Server, href: "/panels" },
      { id: "update", label: "Обновление", icon: RefreshCw, href: "/update" },
    ],
  },
  {
    title: "Логи",
    items: [
      { id: "logs", label: "Server логи", icon: Terminal, href: "/logs" },
    ],
  },
];