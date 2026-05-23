// Общие константы и чистые helper'ы — извлечены из src/pages/Index.tsx без изменений.
import type { CountryDef } from "./types";

// ===== Хранилище логов =====
export const LS_KEY = "app_logs_v1";
export const APP_LOG_MAX = 2000;

// ===== Страны =====
export const COUNTRIES: CountryDef[] = [
  { code: "RU", flag: "🇷🇺", name: "Россия" },
  { code: "CZ", flag: "🇨🇿", name: "Чехия" },
  { code: "DE", flag: "🇩🇪", name: "Германия" },
  { code: "NL", flag: "🇳🇱", name: "Нидерланды" },
  { code: "FR", flag: "🇫🇷", name: "Франция" },
  { code: "GB", flag: "🇬🇧", name: "Великобритания" },
  { code: "US", flag: "🇺🇸", name: "США" },
  { code: "CA", flag: "🇨🇦", name: "Канада" },
  { code: "JP", flag: "🇯🇵", name: "Япония" },
  { code: "SG", flag: "🇸🇬", name: "Сингапур" },
  { code: "TR", flag: "🇹🇷", name: "Турция" },
  { code: "UA", flag: "🇺🇦", name: "Украина" },
  { code: "PL", flag: "🇵🇱", name: "Польша" },
  { code: "FI", flag: "🇫🇮", name: "Финляндия" },
  { code: "SE", flag: "🇸🇪", name: "Швеция" },
  { code: "NO", flag: "🇳🇴", name: "Норвегия" },
  { code: "ES", flag: "🇪🇸", name: "Испания" },
  { code: "IT", flag: "🇮🇹", name: "Италия" },
  { code: "CH", flag: "🇨🇭", name: "Швейцария" },
  { code: "AT", flag: "🇦🇹", name: "Австрия" },
  { code: "KZ", flag: "🇰🇿", name: "Казахстан" },
  { code: "CN", flag: "🇨🇳", name: "Китай" },
  { code: "HK", flag: "🇭🇰", name: "Гонконг" },
  { code: "IN", flag: "🇮🇳", name: "Индия" },
  { code: "BR", flag: "🇧🇷", name: "Бразилия" },
  { code: "AE", flag: "🇦🇪", name: "ОАЭ" },
  { code: "LV", flag: "🇱🇻", name: "Латвия" },
  { code: "LT", flag: "🇱🇹", name: "Литва" },
  { code: "EE", flag: "🇪🇪", name: "Эстония" },
];

export const countryByCode = (c: string) =>
  COUNTRIES.find((x) => x.code === c.toUpperCase());

export const findCountryByPrefix = (s: string) => {
  const trimmed = s.trim();
  for (const c of COUNTRIES) {
    if (trimmed.startsWith(`${c.flag} ${c.name}`)) return c;
    if (trimmed.startsWith(c.flag)) return c;
  }
  return undefined;
};

export const buildDisplay = (countryCode: string, label: string) => {
  const c = countryByCode(countryCode);
  const l = label.trim();
  if (c && l) return `${c.flag} ${l}`;
  if (c) return c.flag;
  return l;
};

// ===== Подписочные URL =====
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const ENV_SUB_BASE = (import.meta.env.VITE_SUB_BASE_URL as string | undefined)?.replace(/\/+$/, "");

export const getSubBase = () => {
  if (typeof window !== "undefined") {
    const ls = window.localStorage.getItem("sub_base_url");
    if (ls) return ls.replace(/\/+$/, "");
    if (ENV_SUB_BASE) return ENV_SUB_BASE;
    // На Lovable preview/published доменах нет /sub backend —
    // фоллбэк на Supabase Edge Function URL, чтобы ссылки резолвились.
    const host = window.location.hostname;
    if (/lovable(project)?\.(app|dev)$/i.test(host) || /\.lovable\.app$/i.test(host)) {
      return `${SUPABASE_URL}/functions/v1/sub`;
    }
    return `${window.location.origin}/sub`;
  }
  return `${SUPABASE_URL}/functions/v1/sub`;
};

export const subUrl = (slug: string) => `${getSubBase()}/${slug}`;
export const happUrl = (slug: string) =>
  `happ://add/${encodeURIComponent(subUrl(slug))}`;

// ===== Тарифы =====
export const PRESETS: { label: string; days: number; gb: number }[] = [
  { label: "Trial 3 дня", days: 3, gb: 5 },
  { label: "1 месяц", days: 30, gb: 0 },
  { label: "3 месяца", days: 90, gb: 0 },
  { label: "6 месяцев", days: 180, gb: 0 },
  { label: "1 год", days: 365, gb: 0 },
  { label: "Безлимит", days: 0, gb: 0 },
];

// ===== Клиентские deeplink-генераторы =====
export const CLIENT_LINKS: { label: string; emoji: string; build: (u: string) => string }[] = [
  { label: "Happ", emoji: "📱", build: (u) => `happ://add/${encodeURIComponent(u)}` },
  { label: "v2RayTun", emoji: "🚀", build: (u) => `v2raytun://import/${encodeURIComponent(u)}` },
  { label: "Streisand", emoji: "🌊", build: (u) => `streisand://import/${u}` },
  { label: "Shadowrocket", emoji: "🚀", build: (u) => `sub://${btoa(u).replace(/=+$/, "")}` },
  { label: "Hiddify", emoji: "🛡️", build: (u) => `hiddify://install-config?url=${encodeURIComponent(u)}` },
  { label: "Clash Meta", emoji: "⚡", build: (u) => `clash://install-config?url=${encodeURIComponent(u)}` },
  { label: "NekoBox", emoji: "🐱", build: (u) => `sn://subscription?url=${encodeURIComponent(u)}` },
];

// ===== Сортировка внешних подписок =====
export const DEFAULT_EXTERNAL_SORT = 1000;
export const PINNED_SORT = -1000;

export const isPinnedSort = (v: number) => Number.isFinite(v) && v < 0;

export const effectiveExternalSort = (perSubSort: number, globalSort: number) => {
  if (isPinnedSort(globalSort)) {
    if (perSubSort === DEFAULT_EXTERNAL_SORT) return globalSort;
    if (isPinnedSort(perSubSort)) return perSubSort;
    return PINNED_SORT + Math.max(1, perSubSort);
  }
  if (isPinnedSort(perSubSort)) return perSubSort;
  return perSubSort !== DEFAULT_EXTERNAL_SORT ? perSubSort : globalSort;
};