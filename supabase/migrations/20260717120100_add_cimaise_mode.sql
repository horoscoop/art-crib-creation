-- KOA Guardian — Second mode Cimaise (assurance/conformité), en plus
-- du mode technique existant. Un seul point d'entrée, historique
-- distingué par mode pour ne pas mélanger les deux contextes dans
-- les statistiques admin ni dans l'affichage.

ALTER TABLE public.cimaise_messages
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'technique'
  CHECK (mode IN ('technique', 'assurance'));
