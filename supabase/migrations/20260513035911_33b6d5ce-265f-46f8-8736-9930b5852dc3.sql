CREATE TABLE public.standalone_servers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 443,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.standalone_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read standalone_servers" 
ON public.standalone_servers FOR SELECT USING (true);

CREATE POLICY "public insert standalone_servers" 
ON public.standalone_servers FOR INSERT WITH CHECK (true);

CREATE POLICY "public update standalone_servers" 
ON public.standalone_servers FOR UPDATE USING (true);

CREATE POLICY "public delete standalone_servers" 
ON public.standalone_servers FOR DELETE USING (true);
