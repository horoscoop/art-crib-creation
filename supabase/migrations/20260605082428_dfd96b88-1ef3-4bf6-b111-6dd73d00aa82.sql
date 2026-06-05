
-- 1. Storage: remove overly permissive artwork-attachments policies
DROP POLICY IF EXISTS "owner read artwork attachments storage" ON storage.objects;
DROP POLICY IF EXISTS "owner write artwork attachments storage" ON storage.objects;
DROP POLICY IF EXISTS "owner delete artwork attachments storage" ON storage.objects;

-- 2. trace_events: drop permissive public SELECT, replace with scoped policy
DROP POLICY IF EXISTS "public read trace events" ON public.trace_events;
DROP POLICY IF EXISTS "anyone can read trace events" ON public.trace_events;
DROP POLICY IF EXISTS "trace_events_select_public" ON public.trace_events;

-- Drop any existing select policies broader than needed
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='trace_events' AND cmd='SELECT' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.trace_events', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "trace_events_owner_or_admin_select"
ON public.trace_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.artworks a
    WHERE a.id = trace_events.artwork_id
      AND (a.owner_id = auth.uid()
           OR public.has_role(auth.uid(), 'admin')
           OR public.has_role(auth.uid(), 'expert_koa'))
  )
);

-- 3. connection_logs: enforce email matches authenticated user's email
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='connection_logs' AND cmd='INSERT' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.connection_logs', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "connection_logs_insert_self"
ON public.connection_logs
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (email IS NULL OR email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))
);

-- 4. user_roles: defense-in-depth restrictive policy blocking non-admin inserts
DROP POLICY IF EXISTS "block non admin role inserts" ON public.user_roles;
CREATE POLICY "block non admin role inserts"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Revoke EXECUTE on internal SECURITY DEFINER functions from public roles.
-- Keep get_trace_passport callable (used by public trace page).
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_default_roles() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_reading_thresholds() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_inspection_next_due() FROM PUBLIC, anon, authenticated;

-- get_trace_passport remains executable by anon (public NFC trace pages)
GRANT EXECUTE ON FUNCTION public.get_trace_passport(text) TO anon, authenticated;
