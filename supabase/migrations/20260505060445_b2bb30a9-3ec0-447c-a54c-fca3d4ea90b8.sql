CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read subscriptions"
  ON public.subscriptions FOR SELECT
  USING (true);

CREATE POLICY "Public can insert subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can delete subscriptions"
  ON public.subscriptions FOR DELETE
  USING (true);