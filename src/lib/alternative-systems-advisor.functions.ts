/**
 * KOA Guardian — Alternatives hors-catalogue pour l'outil de conception.
 * Complète recommendHangingSystemsAdmin (catalogue KOA) par une analyse
 * de solutions concurrentes/génériques du marché, avec avantages et
 * inconvénients, via la passerelle IA déjà utilisée par Cimaise.
 *
 * À placer dans src/lib/alternative-systems-advisor.functions.ts
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Accès réservé aux administrateurs");
}

export interface AlternativeSystem {
  name: string;
  category: string;
  description: string;
  avantages: string[];
  inconvenients: string[];
}

const SYSTEM_PROMPT = `Tu es un expert indépendant en systèmes de fixation et d'accrochage (œuvres d'art, objets de valeur).
On te donne un poids et un type de mur. Le catalogue KOA a déjà été consulté séparément — ne propose PAS
de produits KOA, uniquement des catégories de solutions génériques ou d'autres fabricants du marché
(ex. rails cimaise génériques, chevilles chimiques, systèmes à câble concurrents, plots magnétiques
génériques, vitrines/caissons de sécurité si pertinent pour le poids...).

Réponds UNIQUEMENT en JSON valide, un tableau de 2 à 4 objets, sans texte autour, sans markdown :
[
  {
    "name": "nom générique de la solution",
    "category": "catégorie (ex: fixation mécanique, adhésif, système magnétique...)",
    "description": "1-2 phrases",
    "avantages": ["...", "..."],
    "inconvenients": ["...", "..."]
  }
]

Reste factuel et générique (pas de marque précise ni de prix), 2 à 3 avantages et 2 à 3 inconvénients par solution.`;

export const suggestAlternativeSystemsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      weight_kg: z.number().min(0.1).max(2000),
      wall_type: z.string().max(60).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("IA indisponible (clé manquante).");

    const userPrompt = `Poids de l'œuvre : ${data.weight_kg} kg. Type de mur : ${data.wall_type ?? "non précisé"}.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Trop de requêtes, réessayez dans un instant.");
    if (res.status === 402) throw new Error("Crédits IA épuisés.");
    if (!res.ok) throw new Error(`Analyse indisponible (${res.status}).`);

    const json = await res.json();
    const raw = (json?.choices?.[0]?.message?.content ?? "[]") as string;
    const cleaned = raw.replace(/```json|```/g, "").trim();

    let alternatives: AlternativeSystem[] = [];
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) alternatives = parsed;
    } catch {
      // Réponse IA non structurée : on renvoie une liste vide plutôt que de planter l'écran.
      alternatives = [];
    }

    return alternatives;
  });
