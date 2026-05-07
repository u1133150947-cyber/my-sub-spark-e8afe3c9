ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS raw_links jsonb NOT NULL DEFAULT '[]'::jsonb;