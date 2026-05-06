-- 1. Колонка slug
ALTER TABLE public.panels ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Backfill для двух уже существующих панелей
UPDATE public.panels SET slug = 'cz' WHERE id = '850af5d0-70b1-4c8d-8d56-0e0a75ab342b' AND (slug IS NULL OR slug = '');
UPDATE public.panels SET slug = 'ru' WHERE id = '04f18493-a116-4237-bf8a-cab230706145' AND (slug IS NULL OR slug = '');

-- 3. Для остальных панелей без slug — генерируем
UPDATE public.panels SET slug = 'p' || substr(replace(id::text, '-', ''), 1, 8) WHERE slug IS NULL OR slug = '';

-- 4. Делаем NOT NULL + UNIQUE
ALTER TABLE public.panels ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS panels_slug_key ON public.panels(slug);

-- 5. Обновляем функции каскада: теперь сравнение по slug
CREATE OR REPLACE FUNCTION public.cascade_delete_panel_inbounds()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  DELETE FROM public.subscription_inbounds WHERE panel = OLD.slug;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.cascade_rename_panel_inbounds()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.slug IS DISTINCT FROM OLD.slug THEN
    UPDATE public.subscription_inbounds SET panel = NEW.slug WHERE panel = OLD.slug;
  END IF;
  RETURN NEW;
END;
$$;

-- 6. Чистим осиротевшие inbounds (которые ссылаются на slug которого нет)
DELETE FROM public.subscription_inbounds si
WHERE NOT EXISTS (SELECT 1 FROM public.panels p WHERE p.slug = si.panel);

DELETE FROM public.client_mappings cm
WHERE NOT EXISTS (SELECT 1 FROM public.panels p WHERE p.slug = cm.panel);