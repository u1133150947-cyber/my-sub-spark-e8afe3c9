-- Fix RU cascade subscription port: nginx SNI entry is :8443, not internal :18443
UPDATE public.subscription_inbounds
SET port = 8443
WHERE remark = 'ru-cascade-cz' AND port = 18443;
