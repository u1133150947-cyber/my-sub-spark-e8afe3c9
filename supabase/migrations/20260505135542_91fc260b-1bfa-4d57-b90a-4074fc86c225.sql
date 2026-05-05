CREATE TABLE public.traffic_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL,
  used_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX idx_traffic_snapshots_sub_time ON public.traffic_snapshots(subscription_id, created_at DESC);
CREATE INDEX idx_traffic_snapshots_time ON public.traffic_snapshots(created_at DESC);
ALTER TABLE public.traffic_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read snapshots" ON public.traffic_snapshots FOR SELECT USING (true);
CREATE POLICY "public insert snapshots" ON public.traffic_snapshots FOR INSERT WITH CHECK (true);
CREATE POLICY "public delete snapshots" ON public.traffic_snapshots FOR DELETE USING (true);