-- Drop old policies and table
DROP TABLE IF EXISTS public.subscriptions CASCADE;

CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_uuid TEXT NOT NULL,
  expiry_ms BIGINT NOT NULL DEFAULT 0,
  total_bytes BIGINT NOT NULL DEFAULT 0,
  hits INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.subscription_inbounds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  panel TEXT NOT NULL,           -- 'cz' | 'ru'
  inbound_id INTEGER NOT NULL,
  remark TEXT NOT NULL,
  -- Snapshot of inbound info needed to build vless:// URL:
  protocol TEXT NOT NULL,
  port INTEGER NOT NULL,
  host TEXT NOT NULL,            -- server host (panel host)
  stream_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sub_inbounds_sub ON public.subscription_inbounds(subscription_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_inbounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read subs" ON public.subscriptions FOR SELECT USING (true);
CREATE POLICY "public insert subs" ON public.subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "public delete subs" ON public.subscriptions FOR DELETE USING (true);
CREATE POLICY "public update subs" ON public.subscriptions FOR UPDATE USING (true);

CREATE POLICY "public read sub inbounds" ON public.subscription_inbounds FOR SELECT USING (true);
CREATE POLICY "public insert sub inbounds" ON public.subscription_inbounds FOR INSERT WITH CHECK (true);
CREATE POLICY "public delete sub inbounds" ON public.subscription_inbounds FOR DELETE USING (true);