
-- ===== Lot 1: Roles & admin =====
CREATE TYPE public.app_role AS ENUM ('admin', 'conservateur');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed admin role on signup for whitelisted emails
CREATE OR REPLACE FUNCTION public.assign_default_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IN ('celine.angelats@gmail.com','horoscoop@outlook.fr','nicolas.perbost@yahoo.fr') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'conservateur') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_assign_roles ON auth.users;
CREATE TRIGGER on_auth_user_assign_roles AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_roles();

-- Backfill existing whitelisted users
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
WHERE email IN ('celine.angelats@gmail.com','horoscoop@outlook.fr','nicolas.perbost@yahoo.fr')
ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'conservateur'::public.app_role FROM auth.users ON CONFLICT DO NOTHING;

-- ===== Connection logs =====
CREATE TABLE public.connection_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  event text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.connection_logs TO authenticated;
GRANT ALL ON public.connection_logs TO service_role;
ALTER TABLE public.connection_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insert own log" ON public.connection_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin read logs" ON public.connection_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

-- ===== Hanging systems catalog =====
CREATE TABLE public.hanging_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  max_weight_kg numeric,
  wall_types text[],
  maintenance_interval_years int,
  illustration_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hanging_systems TO authenticated, anon;
GRANT ALL ON public.hanging_systems TO service_role;
ALTER TABLE public.hanging_systems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read systems" ON public.hanging_systems FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "admin manage systems" ON public.hanging_systems FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.hanging_systems (code, name, description, max_weight_kg, wall_types, maintenance_interval_years) VALUES
('KOA-WIRE','KOA Wire','Système de suspension par câble acier inox 2mm avec serre-câble à came. Idéal pour œuvres encadrées sur cimaise.',40,ARRAY['cimaise','plâtre','BA13'],5),
('KOA-MAG','KOA Magnet','Fixation magnétique néodyme N52 pour œuvres légères sur support ferromagnétique. Sans perçage.',8,ARRAY['acier','panneau métallique'],3),
('KOA-CLEAT','KOA Cleat','Profilé aluminium en Z (french cleat) pour œuvres lourdes. Répartition de charge optimale.',120,ARRAY['béton','brique','BA13 renforcé'],10),
('KOA-ADH','KOA Adhesive','Plot adhésif structural acrylique VHB pour surfaces lisses non porteuses. Vitre, panneau composite.',5,ARRAY['verre','métal lisse','composite'],5);

ALTER TABLE public.artworks ADD COLUMN baseline jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.artworks ADD COLUMN hanging_system_id uuid REFERENCES public.hanging_systems(id);

-- ===== Attachments =====
INSERT INTO storage.buckets (id, name, public) VALUES ('artwork-attachments','artwork-attachments', false)
  ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id uuid NOT NULL REFERENCES public.artworks(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  filename text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rw own attachments" ON public.attachments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.artworks a WHERE a.id = attachments.artwork_id AND (a.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artworks a WHERE a.id = attachments.artwork_id AND (a.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE POLICY "read own attachment files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'artwork-attachments' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "upload own attachment files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'artwork-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "delete own attachment files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'artwork-attachments' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));

-- ===== Sensor gateways =====
CREATE TABLE public.sensor_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  protocol text NOT NULL DEFAULT 'webhook',
  endpoint text,
  auth_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  payload_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_interval_s int DEFAULT 300,
  last_sync_at timestamptz,
  status text DEFAULT 'idle',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sensor_gateways TO authenticated;
GRANT ALL ON public.sensor_gateways TO service_role;
ALTER TABLE public.sensor_gateways ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rw own gateways" ON public.sensor_gateways FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.gateway_artwork_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_id uuid NOT NULL REFERENCES public.sensor_gateways(id) ON DELETE CASCADE,
  artwork_id uuid NOT NULL REFERENCES public.artworks(id) ON DELETE CASCADE,
  sensor_field_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (gateway_id, artwork_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gateway_artwork_map TO authenticated;
GRANT ALL ON public.gateway_artwork_map TO service_role;
ALTER TABLE public.gateway_artwork_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rw own map" ON public.gateway_artwork_map FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sensor_gateways g WHERE g.id = gateway_id AND (g.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sensor_gateways g WHERE g.id = gateway_id AND (g.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- ===== Admin override RLS on existing tables =====
DROP POLICY IF EXISTS "own artworks" ON public.artworks;
CREATE POLICY "rw own or admin artworks" ON public.artworks FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "rw own alerts" ON public.alerts;
CREATE POLICY "rw own or admin alerts" ON public.alerts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.artworks a WHERE a.id = alerts.artwork_id AND (a.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artworks a WHERE a.id = alerts.artwork_id AND (a.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

DROP POLICY IF EXISTS "read own readings" ON public.sensor_readings;
DROP POLICY IF EXISTS "insert own readings" ON public.sensor_readings;
DROP POLICY IF EXISTS "delete own readings" ON public.sensor_readings;
CREATE POLICY "rw own or admin readings" ON public.sensor_readings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.artworks a WHERE a.id = sensor_readings.artwork_id AND (a.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artworks a WHERE a.id = sensor_readings.artwork_id AND (a.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

DROP POLICY IF EXISTS "rw own maint" ON public.maintenance_logs;
CREATE POLICY "rw own or admin maint" ON public.maintenance_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.artworks a WHERE a.id = maintenance_logs.artwork_id AND (a.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artworks a WHERE a.id = maintenance_logs.artwork_id AND (a.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

DROP POLICY IF EXISTS "own profile read" ON public.profiles;
CREATE POLICY "read own or admin profiles" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
