-- ============================================================================
-- Module d'appui Expert KOA — "Expert Lab"
-- Faits marquants (veille), benchmark concurrentiel, suggestions catalogue.
-- Réservé aux rôles admin / expert_koa (cf. migrations existantes has_role()).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Faits marquants (fil de veille)
-- ---------------------------------------------------------------------------
CREATE TYPE public.highlight_category AS ENUM ('technique', 'marche', 'reglementaire', 'interne');
CREATE TYPE public.highlight_impact AS ENUM ('faible', 'moyen', 'fort');
CREATE TYPE public.highlight_status AS ENUM ('nouveau', 'traite', 'archive');

CREATE TABLE public.highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category public.highlight_category NOT NULL,
  impact public.highlight_impact NOT NULL DEFAULT 'moyen',
  status public.highlight_status NOT NULL DEFAULT 'nouveau',
  title text NOT NULL,
  summary text NOT NULL,
  source_label text,          -- ex: "editag.com — veille externe" / "agrégat vision_diagnostics"
  source_url text,
  watch_axis text,            -- A/B/C/D/E/F — cf. rapport axes d'investigation
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.highlights IS 'Fil de veille du module Expert Lab : faits marquants techniques, marché, réglementaires ou issus des signaux internes (diagnostics agrégés).';
COMMENT ON COLUMN public.highlights.watch_axis IS 'Référence à un des 6 axes de veille (A: réglementaire, B: concurrence, C: technologique, D: tarifaire, E: terrain, F: marchés publics).';

ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "experts read highlights" ON public.highlights
  FOR SELECT
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'expert_koa'));

CREATE POLICY "experts write highlights" ON public.highlights
  FOR INSERT WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'expert_koa'));

CREATE POLICY "experts update highlights" ON public.highlights
  FOR UPDATE
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'expert_koa'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'expert_koa'));

CREATE POLICY "admin delete highlights" ON public.highlights
  FOR DELETE USING (has_role(auth.uid(),'admin'));

CREATE INDEX highlights_category_idx ON public.highlights(category);
CREATE INDEX highlights_status_idx ON public.highlights(status);
CREATE INDEX highlights_created_at_idx ON public.highlights(created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. Benchmark concurrentiel (catalogue KOA vs marché)
-- ---------------------------------------------------------------------------
CREATE TABLE public.market_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_name text NOT NULL,          -- ex: "Maison Boyer", "Artiteq"
  segment text NOT NULL,                  -- ex: "Cimaise acier haut de gamme (FR)"
  is_koa boolean NOT NULL DEFAULT false,  -- true pour la ligne KOA elle-même
  antivol_renforce text NOT NULL DEFAULT 'non' CHECK (antivol_renforce IN ('non','partiel','oui')),
  eclairage_integre text NOT NULL DEFAULT 'non' CHECK (eclairage_integre IN ('non','partiel','oui')),
  charge_lourde text NOT NULL DEFAULT 'non' CHECK (charge_lourde IN ('non','partiel','oui')),
  instruments_mesure text NOT NULL DEFAULT 'non' CHECK (instruments_mesure IN ('non','partiel','oui')),
  configurateur_digital text NOT NULL DEFAULT 'non' CHECK (configurateur_digital IN ('non','partiel','oui')),
  notes text,
  source_url text,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.market_competitors IS 'Lignes du benchmark concurrentiel affiché dans le module Expert Lab ; une ligne is_koa=true sert de référence.';

ALTER TABLE public.market_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "experts read competitors" ON public.market_competitors
  FOR SELECT
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'expert_koa'));

CREATE POLICY "experts write competitors" ON public.market_competitors
  FOR INSERT WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'expert_koa'));

CREATE POLICY "experts update competitors" ON public.market_competitors
  FOR UPDATE
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'expert_koa'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'expert_koa'));

CREATE POLICY "admin delete competitors" ON public.market_competitors
  FOR DELETE USING (has_role(auth.uid(),'admin'));

-- ---------------------------------------------------------------------------
-- 3. Suggestions de conception & catalogue (kanban)
-- ---------------------------------------------------------------------------
CREATE TYPE public.suggestion_target AS ENUM ('produit_physique', 'catalogue_logiciel');
CREATE TYPE public.suggestion_status AS ENUM ('propose', 'a_l_etude', 'adopte', 'rejete');

CREATE TABLE public.catalog_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  rationale text NOT NULL,               -- justification / description
  target public.suggestion_target NOT NULL,
  status public.suggestion_status NOT NULL DEFAULT 'propose',
  priority text NOT NULL DEFAULT 'moyenne' CHECK (priority IN ('basse','moyenne','haute')),
  linked_highlight_id uuid REFERENCES public.highlights(id) ON DELETE SET NULL,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  decision_note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.catalog_suggestions IS 'Suggestions issues des faits marquants / signaux terrain, ciblant soit la conception produit physique KOA, soit le catalogue logiciel. Workflow: propose -> a_l_etude -> adopte/rejete.';

ALTER TABLE public.catalog_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "experts read suggestions" ON public.catalog_suggestions
  FOR SELECT
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'expert_koa'));

CREATE POLICY "experts write suggestions" ON public.catalog_suggestions
  FOR INSERT WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'expert_koa'));

CREATE POLICY "experts update suggestions" ON public.catalog_suggestions
  FOR UPDATE
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'expert_koa'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'expert_koa'));

CREATE POLICY "admin delete suggestions" ON public.catalog_suggestions
  FOR DELETE USING (has_role(auth.uid(),'admin'));

CREATE INDEX catalog_suggestions_status_idx ON public.catalog_suggestions(status);

-- updated_at triggers (réutilise le pattern si une fonction générique existe déjà ;
-- sinon on la (re)crée ici de façon idempotente)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER highlights_set_updated_at BEFORE UPDATE ON public.highlights
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER competitors_set_updated_at BEFORE UPDATE ON public.market_competitors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER suggestions_set_updated_at BEFORE UPDATE ON public.catalog_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Données d'amorçage — issues de la veille marché réalisée (juillet 2026)
-- ---------------------------------------------------------------------------
INSERT INTO public.market_competitors
  (competitor_name, segment, is_koa, antivol_renforce, eclairage_integre, charge_lourde, instruments_mesure, configurateur_digital, notes)
VALUES
  ('KOA (Kingdom of Arts)', 'Généraliste accroche + conservation', true,  'non', 'non', 'partiel', 'non', 'non',
   'Catalogue large (fixation murale, câbles/cimaises, anneaux, réserve MRT, matériaux de conservation) mais sans avance différenciante sur les 5 axes.'),
  ('Maison Boyer', 'Cimaise acier haut de gamme (FR)', false, 'oui', 'non', 'oui', 'non', 'non',
   'Rails 100% acier, charge de 3 kg à plus de 800 kg, blocage mécanique intégré à 3 points, plus de 200 coloris, garantie 10 ans.'),
  ('Chassitech', 'Généraliste accroche + sécurisation (FR)', false, 'oui', 'partiel', 'partiel', 'non', 'partiel',
   'Revendique la plus large gamme au monde en accrochage/sécurisation, finitions noires pour accroche discrète, devis en ligne.'),
  ('Artiteq / Newly / STAS', 'Cimaise premium (NL)', false, 'partiel', 'oui', 'partiel', 'non', 'oui',
   'Rails avec éclairage LED intégré, garantie 5 ans, configurateurs et assistants virtuels chez les revendeurs spécialisés.'),
  ('Absolute / Ryman', 'Haute sécurité musées (UK)', false, 'oui', 'non', 'partiel', 'non', 'non',
   'Positionnement "solution de sécurité la plus élevée utilisée par les musées du monde entier", outillage de pose dédié.'),
  ('Promuseum / CXD / Klug', 'Muséographie & conservation (FR/DE)', false, 'partiel', 'non', 'non', 'oui', 'non',
   'Gamme élargie aux instruments de mesure environnementale (thermohygromètres, luxmètres, UV-mètres).'),
  ('EDITAG Arts', 'Détection IoT anti-intrusion (FR)', false, 'oui', 'non', 'non', 'non', 'non',
   'Capteurs de protection rapprochée (linéaire, courbe, 360°), zones multiples avec degrés d''alerte différenciés.');

INSERT INTO public.highlights (category, impact, watch_axis, title, summary, source_label)
VALUES
  ('reglementaire', 'fort', 'A',
   'Rapport Marion : 24 recommandations pour sécuriser les musées',
   'Remis le 20 février 2026 à la suite du vol du Louvre (19/10/2025). Propose un plan national de sûreté et de sécurité des collections publiques, piloté en interministériel, avec un fonds de sûreté de 30 M€. 85 % des 1 220 « Musées de France » relèvent de collectivités territoriales.',
   'Veille sectorielle — rapport Marion, ministère de la Culture'),
  ('technique', 'fort', 'C',
   'EDITAG lance un capteur de détection multi-zones pour la protection rapprochée des œuvres',
   'Zones de protection linéaires, courbes ou à 360°, avec degrés d''alerte différenciés — approche IoT que KOA ne couvre pas aujourd''hui dans son catalogue mécanique.',
   'editag.com — veille externe'),
  ('marche', 'moyen', 'B',
   'Maison Boyer et Chassitech dominent le segment antivol mécanique renforcé',
   'Blocage à 3 points intégré au rail (Boyer) et gamme de sécurisation dédiée (Chassitech), quand KOA reste sur des fixations mécaniques simples (vis en T, Herah).',
   'Catalogues fabricants — veille externe'),
  ('marche', 'moyen', 'C',
   'Artiteq, Newly et STAS généralisent l''éclairage LED intégré aux rails',
   'Combi Rail Pro Light, Newly R35, STAS solis sans fil : fonctionnalité absente du catalogue KOA à ce jour.',
   'Catalogues fabricants — veille externe'),
  ('marche', 'moyen', 'D',
   'Promuseum et CXD élargissent leur gamme aux instruments de mesure environnementale',
   'Thermohygromètres, luxmètres, UV-mètres proposés en complément des matériaux de conservation — adjacence naturelle non couverte par KOA.',
   'Catalogues fabricants — veille externe'),
  ('interne', 'moyen', 'E',
   'Parcours "musées / collections publiques" du site KOA renvoie vers un simple courriel',
   'Contrairement au parcours hôtellerie, aucun configurateur ni questionnaire guidé n''existe pour le segment musées — écart d''accompagnement digital face aux revendeurs Artiteq/Newly.',
   'Audit interne du site kingdom-of-arts.com');
