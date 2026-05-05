CREATE OR REPLACE FUNCTION public.cascade_delete_panel_inbounds()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.subscription_inbounds WHERE panel = OLD.name;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_delete_panel_inbounds ON public.panels;
CREATE TRIGGER trg_cascade_delete_panel_inbounds
BEFORE DELETE ON public.panels
FOR EACH ROW
EXECUTE FUNCTION public.cascade_delete_panel_inbounds();