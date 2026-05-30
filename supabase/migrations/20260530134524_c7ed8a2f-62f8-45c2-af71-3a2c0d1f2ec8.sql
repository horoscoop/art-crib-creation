
-- Les triggers tournent en interne, on retire l'EXECUTE public
REVOKE EXECUTE ON FUNCTION public.check_reading_thresholds() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Restreindre la lecture des photos aux propriétaires (le bucket reste "public" pour servir les URLs signées via path)
DROP POLICY IF EXISTS "read photos public" ON storage.objects;
CREATE POLICY "read own photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'artwork-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
