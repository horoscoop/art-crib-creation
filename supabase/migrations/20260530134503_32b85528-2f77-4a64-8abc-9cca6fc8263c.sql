
-- =========== PROFILES ===========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  organization TEXT,
  role TEXT NOT NULL DEFAULT 'conservateur',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read"  ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile write" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- =========== ARTWORKS ===========
CREATE TABLE public.artworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT,
  location TEXT,
  weight_kg NUMERIC(10,2) NOT NULL,
  wall_type TEXT,            -- placo, beton, pierre, brique...
  koa_system TEXT,           -- type de fixation KOA
  install_date DATE,
  photo_url TEXT,            -- photo "état zéro"
  notes TEXT,
  -- seuils personnalisables
  max_humidity NUMERIC(5,2) NOT NULL DEFAULT 70,
  max_tilt_deg NUMERIC(5,2) NOT NULL DEFAULT 1.5,
  max_drift_mm NUMERIC(5,2) NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_artworks_owner ON public.artworks(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artworks TO authenticated;
GRANT ALL ON public.artworks TO service_role;
ALTER TABLE public.artworks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own artworks" ON public.artworks FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- =========== SENSOR READINGS ===========
CREATE TABLE public.sensor_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id UUID NOT NULL REFERENCES public.artworks(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tension_n NUMERIC(10,2),       -- tension du câble en Newton
  tilt_deg NUMERIC(6,3),         -- inclinaison
  drift_mm NUMERIC(6,2),         -- fluage cumulé en mm
  humidity_pct NUMERIC(5,2),
  temperature_c NUMERIC(5,2),
  source TEXT NOT NULL DEFAULT 'manual', -- manual | iot | api
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_readings_artwork_time ON public.sensor_readings(artwork_id, recorded_at DESC);
GRANT SELECT, INSERT, DELETE ON public.sensor_readings TO authenticated;
GRANT ALL ON public.sensor_readings TO service_role;
ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own readings" ON public.sensor_readings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.artworks a WHERE a.id = artwork_id AND a.owner_id = auth.uid()));
CREATE POLICY "insert own readings" ON public.sensor_readings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.artworks a WHERE a.id = artwork_id AND a.owner_id = auth.uid()));
CREATE POLICY "delete own readings" ON public.sensor_readings FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.artworks a WHERE a.id = artwork_id AND a.owner_id = auth.uid()));

-- =========== ALERTS ===========
CREATE TYPE public.alert_severity AS ENUM ('info', 'vigilance', 'critical');
CREATE TYPE public.alert_kind AS ENUM ('humidity', 'tilt', 'drift', 'tension', 'temperature', 'maintenance_due');

CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id UUID NOT NULL REFERENCES public.artworks(id) ON DELETE CASCADE,
  kind public.alert_kind NOT NULL,
  severity public.alert_severity NOT NULL,
  message TEXT NOT NULL,
  measured_value NUMERIC(10,3),
  threshold_value NUMERIC(10,3),
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_artwork ON public.alerts(artwork_id, resolved, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rw own alerts" ON public.alerts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.artworks a WHERE a.id = artwork_id AND a.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artworks a WHERE a.id = artwork_id AND a.owner_id = auth.uid()));

-- =========== MAINTENANCE LOG ===========
CREATE TABLE public.maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id UUID NOT NULL REFERENCES public.artworks(id) ON DELETE CASCADE,
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind TEXT NOT NULL,         -- audit | nettoyage | remplacement | installation | inspection
  description TEXT NOT NULL,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_maint_artwork ON public.maintenance_logs(artwork_id, performed_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_logs TO authenticated;
GRANT ALL ON public.maintenance_logs TO service_role;
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rw own maint" ON public.maintenance_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.artworks a WHERE a.id = artwork_id AND a.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.artworks a WHERE a.id = artwork_id AND a.owner_id = auth.uid()));

-- =========== AUTO ALERT TRIGGER ===========
CREATE OR REPLACE FUNCTION public.check_reading_thresholds()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.artworks%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.artworks WHERE id = NEW.artwork_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF NEW.humidity_pct IS NOT NULL AND NEW.humidity_pct > a.max_humidity THEN
    INSERT INTO public.alerts (artwork_id, kind, severity, message, measured_value, threshold_value)
    VALUES (NEW.artwork_id, 'humidity',
      CASE WHEN NEW.humidity_pct > a.max_humidity + 10 THEN 'critical'::alert_severity ELSE 'vigilance'::alert_severity END,
      'Humidité ' || NEW.humidity_pct || ' % au-dessus du seuil (' || a.max_humidity || ' %). Risque pour les adhésifs structuraux.',
      NEW.humidity_pct, a.max_humidity);
  END IF;

  IF NEW.tilt_deg IS NOT NULL AND ABS(NEW.tilt_deg) > a.max_tilt_deg THEN
    INSERT INTO public.alerts (artwork_id, kind, severity, message, measured_value, threshold_value)
    VALUES (NEW.artwork_id, 'tilt', 'critical',
      'Inclinaison ' || NEW.tilt_deg || '° détectée. Fixation susceptible de céder.',
      NEW.tilt_deg, a.max_tilt_deg);
  END IF;

  IF NEW.drift_mm IS NOT NULL AND NEW.drift_mm > a.max_drift_mm THEN
    INSERT INTO public.alerts (artwork_id, kind, severity, message, measured_value, threshold_value)
    VALUES (NEW.artwork_id, 'drift', 'critical',
      'Fluage de ' || NEW.drift_mm || ' mm détecté. Perte d''adhérence probable.',
      NEW.drift_mm, a.max_drift_mm);
  END IF;

  IF NEW.temperature_c IS NOT NULL AND (NEW.temperature_c > 28 OR NEW.temperature_c < 12) THEN
    INSERT INTO public.alerts (artwork_id, kind, severity, message, measured_value, threshold_value)
    VALUES (NEW.artwork_id, 'temperature', 'vigilance',
      'Température ' || NEW.temperature_c || ' °C hors plage de conservation (12-28 °C).',
      NEW.temperature_c, NULL);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_thresholds
AFTER INSERT ON public.sensor_readings
FOR EACH ROW EXECUTE FUNCTION public.check_reading_thresholds();

-- =========== PROFILE AUTO-CREATE ===========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, organization)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'organization')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========== STORAGE BUCKET ===========
INSERT INTO storage.buckets (id, name, public) VALUES ('artwork-photos', 'artwork-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "read photos public" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'artwork-photos');
CREATE POLICY "upload own photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'artwork-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "update own photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'artwork-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "delete own photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'artwork-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
