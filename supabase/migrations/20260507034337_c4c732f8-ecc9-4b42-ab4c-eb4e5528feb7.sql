CREATE TABLE public.inbound_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panel text NOT NULL,
  inbound_id integer NOT NULL,
  display_remark text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (panel, inbound_id)
);

ALTER TABLE public.inbound_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read inbound overrides" ON public.inbound_overrides FOR SELECT USING (true);
CREATE POLICY "public insert inbound overrides" ON public.inbound_overrides FOR INSERT WITH CHECK (true);
CREATE POLICY "public update inbound overrides" ON public.inbound_overrides FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete inbound overrides" ON public.inbound_overrides FOR DELETE USING (true);

CREATE TRIGGER inbound_overrides_set_updated_at
BEFORE UPDATE ON public.inbound_overrides
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();