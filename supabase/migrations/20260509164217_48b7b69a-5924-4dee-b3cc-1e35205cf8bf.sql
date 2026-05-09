CREATE POLICY "public update subscription external subs"
ON public.subscription_external_subs
FOR UPDATE
USING (true)
WITH CHECK (true);