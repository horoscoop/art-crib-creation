
-- Add new roles to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'musee';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'galerie';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'technicien';

-- Add cartography fields to artworks
ALTER TABLE public.artworks
  ADD COLUMN IF NOT EXISTS site text,
  ADD COLUMN IF NOT EXISTS room text,
  ADD COLUMN IF NOT EXISTS zone text,
  ADD COLUMN IF NOT EXISTS fixation_type text,
  ADD COLUMN IF NOT EXISTS criticality text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS last_check_at timestamptz;

-- Validation trigger for criticality (instead of CHECK constraint)
CREATE OR REPLACE FUNCTION public.validate_artwork_criticality()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.criticality NOT IN ('standard','elevee','critique') THEN
    RAISE EXCEPTION 'criticality must be standard, elevee or critique';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_artwork_criticality ON public.artworks;
CREATE TRIGGER trg_validate_artwork_criticality
  BEFORE INSERT OR UPDATE ON public.artworks
  FOR EACH ROW EXECUTE FUNCTION public.validate_artwork_criticality();
