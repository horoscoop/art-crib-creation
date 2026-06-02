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

const PROMPT_RECO = `Tu es expert KOA en accrochage d'œuvres d'art. À partir des photos (œuvre + mur), recommande un kit KOA adapté.
Règle d'or : la fixation doit supporter 3 à 4× le poids réel. Calcule la charge cible (poids × 4).
Identifie le type de support mural (placo, béton, brique, pierre), la densité visuelle de l'œuvre, les contraintes apparentes.
Réponds en français en Markdown structuré :
## Analyse visuelle
## Charge cible (kg)
## Kit KOA recommandé
## Points de vigilance`;

const PROMPT_DIAG = `Tu es expert KOA en diagnostic d'accrochages installés. À partir de la/des photo(s) d'un système d'accroche déjà posé, détecte les signatures visuelles de défaillance :
- Fatigue mécanique (déformation, microfissures, jeu)
- Corrosion (oxydation, traces brunes/vertes)
- Dégradation du support (fissures murales, éclats, humidité)
- Fluage adhésif (glissement, bavure)
- Risque systémique (alignement, cohérence d'installation)

Pour chaque signature détectée, donne un niveau : mineur, modéré, majeur, critique.
Calcule un indice R_global (0 = parfait, 1 = ruine imminente) selon Miner généralisé.
Réponds en français en Markdown :
## Signatures détectées
## Indice R_global
## Recommandation d'intervention`;

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
      }),
    });
    if (res.status === 429) throw new Error("Trop de requêtes — réessayez dans un instant.");
    if (res.status === 402) throw new Error("Crédits IA épuisés.");
    if (!res.ok) throw new Error(`KOA Vision indisponible (${res.status}).`);
    const json = await res.json();
    const reply = json?.choices?.[0]?.message?.content ?? "Aucune analyse disponible.";
    return { reply: reply as string };
  });
