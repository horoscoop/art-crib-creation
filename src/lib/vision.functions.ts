import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  mode: z.enum(["recommendation", "diagnostic"]),
  context: z.object({
    weight_kg: z.number().nullable().optional(),
    height_m: z.number().nullable().optional(),
    age_years: z.number().nullable().optional(),
    location: z.string().max(200).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  }).partial().optional(),
  images: z.array(z.object({
    label: z.string().max(40),
    data_url: z.string().startsWith("data:image/").max(8_000_000),
  })).min(1).max(3),
});

const TAXONOMIE = `
TAXONOMIE KOA — référentiel obligatoire :

1) TYPES DE MUR (capacité de charge unitaire par point de fixation) :
   - placo_ba13           : 5–15 kg / point (chevilles Molly), risque arrachement élevé
   - placo_double         : 15–25 kg / point
   - brique_creuse        : 10–30 kg / point (chevilles à expansion)
   - brique_pleine        : 40–80 kg / point
   - beton_brut           : 80–200 kg / point (chevilles métal)
   - beton_cellulaire     : 10–25 kg / point (chevilles spécifiques)
   - pierre_taille        : 50–150 kg / point (scellement chimique)
   - pierre_haussmannienne: 40–120 kg / point (moellon + plâtre, variable)
   - bois                 : 30–80 kg / point, NÉCESSITE taquets mobiles (dilatation)
   - inconnu              : présumer placo_ba13 (le plus défavorable)

2) TYPES DE MÉDIA / ŒUVRE :
   - peinture_toile, panneau_bois, papier_encadre, photographie, sculpture_alu,
     sculpture_bronze, sculpture_resine, street_art_pba (peinture à la bombe — fragile, craquelures), mixed_media
   - Bois et PBA = supports ACTIFS : prévoir taquets mobiles ou points de
     fixation tolérants à la dilatation/contrainte.

3) RÈGLE D'OR KOA — Coefficient de sécurité ×4 :
   charge_cible_kg = poids_oeuvre_kg × 4
   (absorbe vibrations, fluage adhésifs, chocs sismiques mineurs)

4) CATALOGUE KITS KOA :
   - kit_magnetique_n52_bidirectionnel : placo, charge ≤ 10 kg, ZÉRO perçage
   - kit_cimaise_standard               : tous murs porteurs, 5–40 kg
   - kit_cimaise_renforcee              : tous murs porteurs, 40–75 kg
   - kit_ryman_allonge                  : béton/pierre, charge > 75 kg (jusqu'à 150 kg)
   - kit_taquets_mobiles_bois           : support bois (obligatoire)
   - kit_scellement_chimique            : pierre/béton, charge > 100 kg
   - kit_adhesif_structural             : INTERDIT en milieu humide > 60 % HR (risque fluage)

5) SIGNATURES DE DÉFAILLANCE (diagnostic) :
   fatigue_mecanique, corrosion, degradation_support, fluage_adhesif, risque_systemique
   Niveaux : mineur (0.1) · modere (0.3) · majeur (0.6) · critique (0.9)
   R_global = 1 - Π(1 - poids_i)  (Miner généralisé)
   Scoring sécurité (%) = round((1 - R_global) × 100)
`;

const PROMPT_RECO = `Tu es ingénieur KOA, cabinet d'expertise en accrochage d'œuvres d'art (référentiel FFCR).
Mission : à partir des photos (œuvre + mur), produire une recommandation d'accrochage scientifique.

${TAXONOMIE}

Méthode :
1. Classifie le mur (texture, indices visuels : joints, grain, peinture).
2. Classifie le média (toile, bois, PBA, sculpture, etc.).
3. Estime le poids si non fourni (fourchette basse–haute en kg).
4. Calcule charge_cible_kg = poids × 4.
5. Choisis le kit KOA adapté (cf. catalogue).
6. Lève les alertes : bois → taquets mobiles ; PBA → manipulation craquelures ; humidité → bannir adhésif structural ; placo + charge élevée → renforcer ou changer de point d'ancrage.
7. Calcule un scoring_securite (0–100) selon adéquation kit/charge/support.

Tu DOIS répondre STRICTEMENT en JSON valide (pas de markdown autour, pas de \`\`\`) avec ce schéma :
{
  "mode": "recommendation",
  "mur_type": "string (clé taxonomie)",
  "mur_confiance": "low|medium|high",
  "media_type": "string (clé taxonomie)",
  "poids_estime_kg": number,
  "charge_cible_kg": number,
  "kit_recommande": "string (clé catalogue)",
  "kit_justification": "string (1-2 phrases FR)",
  "scoring_securite": number,
  "alertes": ["string FR", ...],
  "rapport_md": "string Markdown FR détaillé : ## Analyse mur ## Analyse œuvre ## Charge cible ## Kit recommandé ## Points de vigilance"
}`;

const PROMPT_DIAG = `Tu es ingénieur KOA, diagnostic d'un système d'accroche installé.

${TAXONOMIE}

Méthode :
1. Identifie le mur et le système installé.
2. Détecte chaque signature de défaillance (fatigue, corrosion, support, fluage, systémique) avec un niveau.
3. Calcule R_global puis scoring_securite (%).
4. Recommande une intervention (aucune / surveillance / remplacement urgent).
5. Propose le kit KOA de remplacement si nécessaire.

Tu DOIS répondre STRICTEMENT en JSON valide (pas de markdown autour) :
{
  "mode": "diagnostic",
  "mur_type": "string",
  "systeme_actuel": "string",
  "signatures": [{"type": "string", "niveau": "mineur|modere|majeur|critique"}],
  "r_global": number,
  "scoring_securite": number,
  "intervention": "aucune|surveillance|remplacement|urgent",
  "kit_recommande": "string|null",
  "alertes": ["string FR", ...],
  "rapport_md": "string Markdown FR : ## Signatures détectées ## Indice R_global ## Recommandation"
}`;

export type VisionReport = {
  mode: "recommendation" | "diagnostic";
  mur_type?: string;
  mur_confiance?: string;
  media_type?: string;
  systeme_actuel?: string;
  poids_estime_kg?: number;
  charge_cible_kg?: number;
  kit_recommande?: string | null;
  kit_justification?: string;
  signatures?: { type: string; niveau: string }[];
  r_global?: number;
  scoring_securite: number;
  intervention?: string;
  alertes: string[];
  rapport_md: string;
};

export const analyzeKoaVision = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Lovable AI indisponible.");

    const system = data.mode === "recommendation" ? PROMPT_RECO : PROMPT_DIAG;
    const ctx = data.context ?? {};
    const ctxText = `Contexte fourni :
- Poids œuvre : ${ctx.weight_kg ?? "non renseigné"} kg
- Hauteur de suspension : ${ctx.height_m ?? "non renseigné"} m
- Âge système : ${ctx.age_years ?? "non renseigné"} ans
- Emplacement : ${ctx.location ?? "non renseigné"}
- Notes : ${ctx.notes ?? "—"}`;

    const content: any[] = [{ type: "text", text: ctxText }];
    for (const img of data.images) {
      content.push({ type: "text", text: `Photo : ${img.label}` });
      content.push({ type: "image_url", image_url: { url: img.data_url } });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: system },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429) throw new Error("Trop de requêtes — réessayez dans un instant.");
    if (res.status === 402) throw new Error("Crédits IA épuisés.");
    if (!res.ok) throw new Error(`KOA Vision indisponible (${res.status}).`);
    const json = await res.json();
    const raw = json?.choices?.[0]?.message?.content ?? "{}";

    let parsed: VisionReport;
    try {
      // Tolérance : enlever d'éventuels ```json
      const cleaned = String(raw).replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback : renvoyer un rapport minimal avec le texte brut
      parsed = {
        mode: data.mode,
        scoring_securite: 0,
        alertes: ["Analyse IA non structurée — voir rapport brut."],
        rapport_md: String(raw),
      };
    }

    // Garde-fous numériques
    if (typeof parsed.scoring_securite !== "number") parsed.scoring_securite = 0;
    parsed.scoring_securite = Math.max(0, Math.min(100, Math.round(parsed.scoring_securite)));
    if (!Array.isArray(parsed.alertes)) parsed.alertes = [];
    if (typeof parsed.rapport_md !== "string") parsed.rapport_md = "";

    return { report: parsed };
  });
