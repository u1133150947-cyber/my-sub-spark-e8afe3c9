CREATE TABLE IF NOT EXISTS public.client_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panel text NOT NULL,
  client_email text NOT NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(panel, client_email)
);
ALTER TABLE public.client_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read mappings" ON public.client_mappings FOR SELECT USING (true);
CREATE POLICY "public insert mappings" ON public.client_mappings FOR INSERT WITH CHECK (true);
CREATE POLICY "public update mappings" ON public.client_mappings FOR UPDATE USING (true);
CREATE POLICY "public delete mappings" ON public.client_mappings FOR DELETE USING (true);