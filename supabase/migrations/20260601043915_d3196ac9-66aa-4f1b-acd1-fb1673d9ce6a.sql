
CREATE TABLE public.inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id UUID NOT NULL,
  inspector_id UUID NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_type TEXT NOT NULL DEFAULT 'ad_hoc',
  notes TEXT,
  score_global NUMERIC,
  signatures JSONB NOT NULL DEFAULT '{}'::jsonb,
  next_due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspections TO authenticated;
GRANT ALL ON public.inspections TO service_role;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rw own or admin inspections" ON public.inspections
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.artworks a WHERE a.id = inspections.artwork_id AND (a.owner_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'expert_koa'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artworks a WHERE a.id = inspections.artwork_id AND (a.owner_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'expert_koa'))));

CREATE TABLE public.expertises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id UUID NOT NULL,
  expert_id UUID NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  type TEXT NOT NULL DEFAULT 'audit',
  rapport TEXT NOT NULL,
  recommandations TEXT,
  charge_mesuree_kg NUMERIC,
  kit_recommande TEXT,
  certificat_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expertises TO authenticated;
GRANT ALL ON public.expertises TO service_role;
ALTER TABLE public.expertises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read expertises" ON public.expertises
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.artworks a WHERE a.id = expertises.artwork_id AND (a.owner_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'expert_koa'))));
CREATE POLICY "experts write expertises" ON public.expertises
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'expert_koa'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'expert_koa'));

CREATE TABLE public.backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  size_bytes BIGINT,
  storage_path TEXT NOT NULL,
  tables_count INTEGER,
  rows_count INTEGER,
  notes TEXT
);
GRANT SELECT, INSERT, DELETE ON public.backups TO authenticated;
GRANT ALL ON public.backups TO service_role;
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage backups" ON public.backups
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'admin'));

INSERT INTO storage.buckets (id, name, public) VALUES ('db-backups','db-backups', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "admin read backups storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'db-backups' AND has_role(auth.uid(),'admin'));
CREATE POLICY "admin write backups storage" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'db-backups' AND has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete backups storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'db-backups' AND has_role(auth.uid(),'admin'));

CREATE POLICY "owner read artwork attachments storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'artwork-attachments');
CREATE POLICY "owner write artwork attachments storage" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'artwork-attachments');
CREATE POLICY "owner delete artwork attachments storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'artwork-attachments');

CREATE OR REPLACE FUNCTION public.set_inspection_next_due()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.next_due_at IS NULL THEN
    NEW.next_due_at := CASE NEW.period_type
      WHEN 'monthly' THEN NEW.performed_at + INTERVAL '1 month'
      WHEN 'quarterly' THEN NEW.performed_at + INTERVAL '3 months'
      WHEN 'annual' THEN NEW.performed_at + INTERVAL '1 year'
      ELSE NULL
    END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_inspection_next_due
  BEFORE INSERT OR UPDATE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.set_inspection_next_due();
