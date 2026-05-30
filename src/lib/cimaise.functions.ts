import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(4000),
  })).min(1).max(40),
});

const SYSTEM = `Tu es "Cimaise", l'assistant technique de KOA (Kingdom of Arts), spécialiste des systèmes d'accroche d'œuvres d'art.
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

export const askCimaise = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Lovable AI indisponible (clé manquante).");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM }, ...data.messages],
      }),
    });

    if (res.status === 429) throw new Error("Trop de requêtes, réessayez dans un instant.");
    if (res.status === 402) throw new Error("Crédits IA épuisés.");
    if (!res.ok) throw new Error(`Cimaise indisponible (${res.status}).`);

    const json = await res.json();
    const reply = json?.choices?.[0]?.message?.content ?? "Je n'ai pas de réponse.";
    return { reply: reply as string };
  });
