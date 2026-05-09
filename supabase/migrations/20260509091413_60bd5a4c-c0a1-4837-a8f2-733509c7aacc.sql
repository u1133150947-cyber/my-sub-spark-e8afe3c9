ALTER TABLE public.external_subs ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 1000;
CREATE INDEX IF NOT EXISTS idx_external_subs_sort_order ON public.external_subs(sort_order);