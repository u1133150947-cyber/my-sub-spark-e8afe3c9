
CREATE TABLE IF NOT EXISTS public.external_subs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '🌐',
  source_url text NOT NULL DEFAULT '',
  raw_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.external_subs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read external_subs" ON public.external_subs FOR SELECT USING (true);
CREATE POLICY "public insert external_subs" ON public.external_subs FOR INSERT WITH CHECK (true);
CREATE POLICY "public update external_subs" ON public.external_subs FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete external_subs" ON public.external_subs FOR DELETE USING (true);
CREATE TRIGGER set_external_subs_updated BEFORE UPDATE ON public.external_subs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.subscription_external_subs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL,
  external_sub_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subscription_id, external_sub_id)
);
ALTER TABLE public.subscription_external_subs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read ses" ON public.subscription_external_subs FOR SELECT USING (true);
CREATE POLICY "public insert ses" ON public.subscription_external_subs FOR INSERT WITH CHECK (true);
CREATE POLICY "public delete ses" ON public.subscription_external_subs FOR DELETE USING (true);
CREATE INDEX IF NOT EXISTS idx_ses_sub ON public.subscription_external_subs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_ses_ext ON public.subscription_external_subs(external_sub_id);
