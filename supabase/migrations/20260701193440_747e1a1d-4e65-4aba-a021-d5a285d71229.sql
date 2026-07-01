
-- Section 2.3: multi-photos on artworks
ALTER TABLE public.artworks ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}';

-- Section 3.1: notification preferences per user
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_alerts_enabled boolean NOT NULL DEFAULT false,
  email_alerts_severity text NOT NULL DEFAULT 'critical',
  notify_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own notification prefs" ON public.notification_preferences;
CREATE POLICY "own notification prefs"
  ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_notification_preferences()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_touch_notification_preferences ON public.notification_preferences;
CREATE TRIGGER trg_touch_notification_preferences BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_notification_preferences();

-- Section 4.1: inspection status view
CREATE OR REPLACE VIEW public.artwork_inspection_status
WITH (security_invoker = true) AS
SELECT
  a.id AS artwork_id,
  a.title,
  a.location,
  a.site,
  a.room,
  a.criticality,
  a.owner_id,
  i.last_inspection_at,
  i.next_due_at,
  i.last_score,
  i.last_period_type,
  CASE
    WHEN i.next_due_at IS NULL THEN 'jamais_inspecte'
    WHEN i.next_due_at < NOW() THEN 'en_retard'
    WHEN i.next_due_at < NOW() + INTERVAL '7 days' THEN 'echeance_proche'
    ELSE 'a_jour'
  END AS inspection_status
FROM public.artworks a
LEFT JOIN LATERAL (
  SELECT
    performed_at AS last_inspection_at,
    next_due_at,
    score_global AS last_score,
    period_type AS last_period_type
  FROM public.inspections
  WHERE artwork_id = a.id
  ORDER BY performed_at DESC
  LIMIT 1
) i ON true;
GRANT SELECT ON public.artwork_inspection_status TO authenticated;

-- Section 4.4: reminder logs
CREATE TABLE IF NOT EXISTS public.reminder_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id uuid NOT NULL REFERENCES public.artworks(id) ON DELETE CASCADE,
  reminder_type text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_to text NOT NULL
);
GRANT SELECT, INSERT ON public.reminder_logs TO authenticated;
GRANT ALL ON public.reminder_logs TO service_role;
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin read reminder_logs" ON public.reminder_logs;
CREATE POLICY "admin read reminder_logs" ON public.reminder_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "authenticated insert reminder_logs" ON public.reminder_logs;
CREATE POLICY "authenticated insert reminder_logs" ON public.reminder_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Realtime for alerts
ALTER TABLE public.alerts REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'alerts'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts';
  END IF;
END $$;
