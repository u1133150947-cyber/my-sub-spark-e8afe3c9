ALTER TABLE public.subscription_inbounds ADD COLUMN IF NOT EXISTS client_email text;
UPDATE public.subscription_inbounds si SET client_email = s.client_email FROM public.subscriptions s WHERE si.subscription_id = s.id AND si.client_email IS NULL;
ALTER TABLE public.subscription_inbounds ALTER COLUMN client_email SET NOT NULL;