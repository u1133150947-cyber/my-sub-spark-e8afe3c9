// Утилиты форматирования, парсинга и глобальная инфраструктура логов.
// Извлечены из src/pages/Index.tsx без изменения поведения.
//
// ВАЖНО: импорт этого модуля имеет сайд-эффект — он:
//   1) восстанавливает APP_LOGS из localStorage;
//   2) патчит toast.error/warning, console.error/warn (под debug-флагом),
//      window 'error' и 'unhandledrejection' — чтобы агрегировать ошибки.
// Сайд-эффект ставится единожды через window.__appLogPatched.

import { toast } from "sonner";
import type { AppLog } from "./types";
import { LS_KEY, APP_LOG_MAX } from "./constants";

// ===== Форматирование =====
export const fmtExpire = (ms: number) => {
  if (!ms) return "∞";
  const d = new Date(ms);
  return d.toLocaleDateString("ru-RU");
};

export const fmtGB = (b: number) =>
  b ? `${(b / 1024 / 1024 / 1024).toFixed(0)} GB` : "∞";

// ===== Парсинг конфигов =====
export const decodeMaybeBase64 = (text: string) => {
  const trimmed = text.trim();
  if (/^(vless|vmess|trojan|ss):\/\//im.test(trimmed)) return trimmed;
  const compact = trimmed.replace(/\s+/g, "");
  try {
    const normalized = compact.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "===".slice((normalized.length + 3) % 4);
    return decodeURIComponent(escape(atob(padded)));
  } catch {
    return trimmed;
  }
};

export const extractConfigLinks = (text: string) =>
  decodeMaybeBase64(text)
    .split(/[\r\n]+/)
    .map((x) => x.trim())
    .filter((x) => /^(vless|vmess|trojan|ss):\/\//i.test(x));

// ===== Глобальный лог ошибок/событий =====
export const APP_LOGS: AppLog[] = (() => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
})();

export const APP_LOG_LISTENERS = new Set<() => void>();

let saveTimer: any = null;
function persistLogs() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(APP_LOGS.slice(-APP_LOG_MAX)));
    } catch {}
  }, 500);
}

export function pushLog(level: AppLog["level"], source: string, message: string) {
  APP_LOGS.push({ ts: Date.now(), level, source, message });
  if (APP_LOGS.length > APP_LOG_MAX) APP_LOGS.splice(0, APP_LOGS.length - APP_LOG_MAX);
  persistLogs();
  APP_LOG_LISTENERS.forEach((fn) => {
    try { fn(); } catch {}
  });
}

// Перехват toast.error/warning + console.error/warn + window.onerror
if (typeof window !== "undefined" && !(window as any).__appLogPatched) {
  (window as any).__appLogPatched = true;
  // Verbose console interception only when debug flag активен (localStorage.debug === '1').
  // По умолчанию — НЕ оборачиваем console.error/warn, чтобы не шуметь в проде и не дублировать в audit_log.
  const __debugOn = (() => {
    try { return localStorage.getItem("debug") === "1"; } catch { return false; }
  })();
  const origErr = toast.error.bind(toast);
  const origWarn = (toast as any).warning?.bind(toast);
  (toast as any).error = (msg: any, opts?: any) => {
    const text = typeof msg === "string" ? msg : (msg?.message ?? JSON.stringify(msg));
    pushLog("error", "toast", String(text) + (opts?.description ? `\n${opts.description}` : ""));
    return origErr(msg, opts);
  };
  if (origWarn) (toast as any).warning = (msg: any, opts?: any) => {
    const text = typeof msg === "string" ? msg : (msg?.message ?? JSON.stringify(msg));
    pushLog("warn", "toast", String(text) + (opts?.description ? `\n${opts.description}` : ""));
    return origWarn(msg, opts);
  };
  if (__debugOn) {
    const ce = console.error.bind(console);
    console.error = (...args: any[]) => {
      pushLog("error", "console", args.map((a) => typeof a === "string" ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })()).join(" "));
      ce(...args);
    };
    const cw = console.warn.bind(console);
    console.warn = (...args: any[]) => {
      pushLog("warn", "console", args.map((a) => typeof a === "string" ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })()).join(" "));
      cw(...args);
    };
  }
  window.addEventListener("error", (e) => pushLog("error", "window", `${e.message} @ ${e.filename}:${e.lineno}`));
  window.addEventListener("unhandledrejection", (e: any) => pushLog("error", "promise", String(e?.reason?.message ?? e?.reason ?? e)));
}