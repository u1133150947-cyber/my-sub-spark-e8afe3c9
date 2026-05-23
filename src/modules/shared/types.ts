// Общие типы приложения — извлечены из src/pages/Index.tsx без изменений сигнатур.

export type AppLog = {
  ts: number;
  level: "error" | "warn" | "info";
  source: string;
  message: string;
};

export type Subscription = {
  id: string;
  slug: string;
  name: string;
  client_email: string;
  expiry_ms: number;
  total_bytes: number;
  hits: number;
  created_at: string;
  raw_links?: string[];
};

export type InboundClient = { email: string; id?: string; enable?: boolean };

export type InboundInfo = {
  id: number;
  remark: string;
  protocol: string;
  port: number;
  enable: boolean;
  clients?: InboundClient[];
};

export type PanelKey = string;

export type PanelMeta = { slug: string; name: string };

export type InboundsResp = Record<string, InboundInfo[] | { error: string } | PanelMeta[]> & {
  _panels?: PanelMeta[];
};

export type SubInbound = { panel: PanelKey; inbound_id: number; remark: string };

// Серверная запись audit_log (вкладка «Логи»)
export type ServerLog = {
  id: string;
  ts: string;
  level: string;
  action: string;
  panel_slug: string | null;
  subscription_id: string | null;
  status: string | null;
  duration_ms: number | null;
  error: string | null;
  request_id: string | null;
  meta: any;
};

export type CountryDef = { code: string; flag: string; name: string };