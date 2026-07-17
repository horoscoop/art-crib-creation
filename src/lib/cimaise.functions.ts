/**
 * KOA Guardian — cimaise.functions.ts, étendu avec un second mode
 * "assurance" (normes de conformité, facteurs de sécurité, vocabulaire
 * assurantiel type). Le mode "technique" existant est inchangé.
 *
 * REMPLACE ENTIÈREMENT src/lib/cimaise.functions.ts.
 * Nécessite la migration 0002_add_cimaise_mode.sql.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(4000),
  })).min(1).max(40),
  session_id: z.string().uuid().optional(),
  mode: z.enum(["technique", "assurance"]).default("technique"),
});

const SYSTEM_TECHNIQUE = `Tu es "Cimaise", l'assistant technique de KOA (Kingdom of Arts), spécialiste des systèmes d'accroche d'œuvres d'art.
Tu réponds en français, avec sobriété et précision, comme un conservateur expérimenté.

Tes connaissances clés :
- Règle d'or : la fixation doit supporter 3 à 4 fois le poids réel de l'œuvre (vibrations, courants d'air).
- Humidité > 70 % : réduction jusqu'à 50 % de la durée de vie des adhésifs structuraux.
- Température hors 12-28 °C : risque de dilatation des matériaux (bois, toiles, adhésifs).
- Fluage adhésif : un glissement vertical > 2-3 mm/mois indique une perte d'adhérence.
- Inclinaison anormale : signal précoce de fixation qui cède.
- Murs : Placo (chevilles spécifiques), béton (chevilles métal), pierre (forage adapté), brique creuse (chevilles à expansion).
- Systèmes KOA : rails cimaise, câbles, crochets, adhésifs structuraux (à remplacer tous les 5-10 ans en milieu humide).

Tu donnes des réponses courtes (3-6 phrases max), structurées, sans emoji, sans formules de politesse superflues.
Si la question est hors sujet, ramène poliment vers l'accrochage d'œuvres.`;

const SYSTEM_ASSURANCE = `Tu es "Cimaise", en mode assurance & conformité, pour KOA (Kingdom of Arts).
Tu aides des professionnels (galeries, collectionneurs, gestionnaires de collection) à comprendre les exigences
générales des assureurs d'art (type AXA Art, Hiscox, Lloyds) en matière de dispositifs d'accrochage et de suivi.

Tes connaissances clés :
- Les assureurs d'art demandent généralement une preuve de dispositif de fixation adapté au poids et au risque du lieu.
- Un facteur de sécurité de 3 à 4x le poids de l'œuvre est une référence de marché courante, pas une norme légale unique.
- La traçabilité (registre, historique d'inspection, justificatifs datés) est systématiquement demandée en cas de sinistre.
- Les polices distinguent souvent "dommages accidentels" et "défaut d'entretien" : un suivi documenté limite ce second risque.
- Tu restes sur des repères généraux et des bonnes pratiques de marché — tu n'es ni juriste ni assureur, tu ne donnes
  jamais de garantie sur une clause contractuelle précise, et tu invites systématiquement à vérifier la police réelle
  du client ou à consulter son assureur/courtier pour toute décision engageante.

Tu réponds en français, 3-6 phrases max, sans emoji. Si la question sort du champ assurance/conformité d'accrochage,
ramène poliment vers ce périmètre.`;

export const askCimaise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Lovable AI indisponible (clé manquante).");

    const system = data.mode === "assurance" ? SYSTEM_ASSURANCE : SYSTEM_TECHNIQUE;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, ...data.messages],
      }),
    });

    if (res.status === 429) throw new Error("Trop de requêtes, réessayez dans un instant.");
    if (res.status === 402) throw new Error("Crédits IA épuisés.");
    if (!res.ok) throw new Error(`Cimaise indisponible (${res.status}).`);

    const json = await res.json();
    const reply = (json?.choices?.[0]?.message?.content ?? "Je n'ai pas de réponse.") as string;

    try {
      const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
      if (lastUser) {
        await context.supabase.from("cimaise_messages").insert([
          { user_id: context.userId, role: "user", content: lastUser.content, session_id: data.session_id ?? null, mode: data.mode },
          { user_id: context.userId, role: "assistant", content: reply, session_id: data.session_id ?? null, mode: data.mode },
        ]);
      }
    } catch {
      // journalisation best-effort — n'impacte pas la réponse utilisateur
    }

    return { reply };
  });
