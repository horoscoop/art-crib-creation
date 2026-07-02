
-- 1. Approval workflow for user profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;
-- Approve all existing users to avoid lockout
UPDATE public.profiles SET approved = true WHERE approved = false;

-- Auto-approve users who are admin or expert_koa when profile is created
CREATE OR REPLACE FUNCTION public.auto_approve_privileged()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role IN ('admin','expert_koa')) THEN
    UPDATE public.profiles SET approved = true WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS user_roles_auto_approve ON public.user_roles;
CREATE TRIGGER user_roles_auto_approve
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.auto_approve_privileged();

-- Allow admins to update any profile (needed for approve action)
DROP POLICY IF EXISTS "admin update profiles" ON public.profiles;
CREATE POLICY "admin update profiles" ON public.profiles
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Persist Cimaise conversation for admin analytics
CREATE TABLE IF NOT EXISTS public.cimaise_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  session_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cimaise_messages_user_idx ON public.cimaise_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cimaise_messages_session_idx ON public.cimaise_messages(session_id);
GRANT SELECT, INSERT ON public.cimaise_messages TO authenticated;
GRANT ALL ON public.cimaise_messages TO service_role;
ALTER TABLE public.cimaise_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own insert cimaise" ON public.cimaise_messages
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "read own or admin cimaise" ON public.cimaise_messages
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete cimaise" ON public.cimaise_messages
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- 3. Archive of KOA Vision diagnostics
CREATE TABLE IF NOT EXISTS public.vision_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artwork_id uuid REFERENCES public.artworks(id) ON DELETE SET NULL,
  mode text NOT NULL CHECK (mode IN ('recommendation','diagnostic')),
  scoring_securite int,
  kit_recommande text,
  report jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vision_diagnostics_user_idx ON public.vision_diagnostics(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.vision_diagnostics TO authenticated;
GRANT ALL ON public.vision_diagnostics TO service_role;
ALTER TABLE public.vision_diagnostics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own insert vision" ON public.vision_diagnostics
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "read own or admin vision" ON public.vision_diagnostics
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete vision" ON public.vision_diagnostics
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- 4. Allow admins to delete expertises (own already allowed by owner policy)
DROP POLICY IF EXISTS "admin delete expertises" ON public.expertises;
CREATE POLICY "admin delete expertises" ON public.expertises
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
