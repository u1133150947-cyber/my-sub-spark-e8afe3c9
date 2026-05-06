ALTER TABLE public.panels ALTER COLUMN slug DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.panels_autogen_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := 'p' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_panels_autogen_slug ON public.panels;
CREATE TRIGGER trg_panels_autogen_slug
BEFORE INSERT ON public.panels
FOR EACH ROW
EXECUTE FUNCTION public.panels_autogen_slug();