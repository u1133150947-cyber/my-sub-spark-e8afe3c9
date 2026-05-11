WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY subscription_id, panel ORDER BY sort_order ASC, inbound_id ASC) AS rn
  FROM public.subscription_inbounds
)
DELETE FROM public.subscription_inbounds WHERE id IN (SELECT id FROM ranked WHERE rn > 1);