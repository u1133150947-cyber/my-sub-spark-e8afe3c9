DROP TRIGGER IF EXISTS trg_cascade_delete_panel_inbounds ON public.panels;
CREATE TRIGGER trg_cascade_delete_panel_inbounds
BEFORE DELETE ON public.panels
FOR EACH ROW
EXECUTE FUNCTION public.cascade_delete_panel_inbounds();

DROP TRIGGER IF EXISTS trg_cascade_rename_panel_inbounds ON public.panels;
CREATE TRIGGER trg_cascade_rename_panel_inbounds
AFTER UPDATE ON public.panels
FOR EACH ROW
EXECUTE FUNCTION public.cascade_rename_panel_inbounds();

-- Чистим уже осиротевшие записи (inbounds от уже удалённых панелей)
DELETE FROM public.subscription_inbounds si
WHERE NOT EXISTS (SELECT 1 FROM public.panels p WHERE p.name = si.panel);