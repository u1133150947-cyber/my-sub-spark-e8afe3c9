CREATE TABLE public.panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  host text NOT NULL,
  public_host text NOT NULL DEFAULT '',
  panel_url text NOT NULL,
  username text NOT NULL,
  password text NOT NULL,
  template text NOT NULL DEFAULT 'cascade_yandex',
  readiness text NOT NULL DEFAULT 'auto',
  ssh_user text NOT NULL DEFAULT 'root',
  ssh_port integer NOT NULL DEFAULT 22,
  ssh_auth_type text NOT NULL DEFAULT 'password',
  ssh_password text NOT NULL DEFAULT '',
  ssh_key_passphrase text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'unknown',
  status_message text NOT NULL DEFAULT '',
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.panels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read panels" ON public.panels FOR SELECT USING (true);
CREATE POLICY "public insert panels" ON public.panels FOR INSERT WITH CHECK (true);
CREATE POLICY "public update panels" ON public.panels FOR UPDATE USING (true);
CREATE POLICY "public delete panels" ON public.panels FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER panels_set_updated_at
BEFORE UPDATE ON public.panels
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();