CREATE UNIQUE INDEX IF NOT EXISTS subscription_inbounds_one_per_panel
  ON public.subscription_inbounds (subscription_id, panel);