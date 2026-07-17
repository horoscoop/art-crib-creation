-- KOA Guardian — Phase 3 : mesures quantitatives en complément des signatures
-- qualitatives existantes (validé : les deux coexistent, aucun remplacement).
-- Reprend les 3 mesures du prototype AI Studio : tension mesurée (N),
-- glissement de câble (mm), hauteur laser de contrôle (cm).

ALTER TABLE public.inspections
  ADD COLUMN measures JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.inspections.measures IS
  'Mesures quantitatives optionnelles : { tension_n?: number, glissement_mm?: number, hauteur_laser_cm?: number }. Complète (ne remplace pas) les signatures qualitatives.';
