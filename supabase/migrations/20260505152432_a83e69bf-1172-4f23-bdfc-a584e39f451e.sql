CREATE OR REPLACE FUNCTION public.cascade_rename_panel_inbounds()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.subscription_inbounds SET panel = NEW.name WHERE panel = OLD.name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_rename_panel_inbounds ON public.panels;
CREATE TRIGGER trg_cascade_rename_panel_inbounds
AFTER UPDATE OF name ON public.panels
FOR EACH ROW
EXECUTE FUNCTION public.cascade_rename_panel_inbounds();

-- subscription_inbounds also needs UPDATE policy for cascade rename to work
CREATE POLICY "public update sub inbounds"
ON public.subscription_inbounds
FOR UPDATE
USING (true)
WITH CHECK (true);