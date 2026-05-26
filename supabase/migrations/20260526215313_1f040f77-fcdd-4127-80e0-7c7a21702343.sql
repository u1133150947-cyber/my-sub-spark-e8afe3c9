ALTER TABLE public.standalone_servers
  ADD COLUMN IF NOT EXISTS stats_port integer,
  ADD COLUMN IF NOT EXISTS stats_secret text;