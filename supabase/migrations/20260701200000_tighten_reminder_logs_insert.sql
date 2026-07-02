-- reminder_logs previously allowed ANY authenticated user to insert a row
-- for ANY artwork_id (WITH CHECK (true)). Tighten to owner/admin, matching
-- the pattern used on every other artwork-scoped table.
DROP POLICY IF EXISTS "authenticated insert reminder_logs" ON public.reminder_logs;
CREATE POLICY "insert own or admin reminder_logs" ON public.reminder_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.artworks a
      WHERE a.id = reminder_logs.artwork_id
        AND (a.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );
