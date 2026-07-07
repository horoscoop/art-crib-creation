import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertExpertOrAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId)
    .in("role", ["admin", "expert_koa"]);
  if (!data || data.length === 0) throw new Error("Réservé aux experts KOA et administrateurs");
}

// ---------------------------------------------------------------------------
// Faits marquants (fil de veille)
// ---------------------------------------------------------------------------

export const listHighlights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ category: z.enum(["technique", "marche", "reglementaire", "interne"]).optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertExpertOrAdmin(context.userId);
    let query = context.supabase.from("highlights").select("*").order("created_at", { ascending: false });
    if (data.category) query = query.eq("category", data.category);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createHighlight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      category: z.enum(["technique", "marche", "reglementaire", "interne"]),
      impact: z.enum(["faible", "moyen", "fort"]).default("moyen"),
      title: z.string().min(1).max(300),
      summary: z.string().min(1).max(4000),
      source_label: z.string().max(300).optional(),
      source_url: z.string().url().max(500).optional(),
      watch_axis: z.enum(["A", "B", "C", "D", "E", "F"]).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertExpertOrAdmin(context.userId);
    const { data: row, error } = await context.supabase.from("highlights").insert({
      ...data,
      created_by: context.userId,
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateHighlightStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), status: z.enum(["nouveau", "traite", "archive"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertExpertOrAdmin(context.userId);
    const { error } = await context.supabase.from("highlights").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Relance à la demande : génère des faits marquants via Lovable AI
// ---------------------------------------------------------------------------
export const runWatchAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertExpertOrAdmin(context.userId);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Lovable AI indisponible (clé manquante).");

    // Contexte : derniers titres pour éviter les doublons.
    const { data: recent } = await supabaseAdmin
      .from("highlights").select("title").order("created_at", { ascending: false }).limit(20);
    const seen = (recent ?? []).map((r: any) => `- ${r.title}`).join("\n");

    const SYSTEM = `Tu es l'analyste veille de KOA (Kingdom of Arts), fabricant de systèmes d'accroche d'œuvres d'art (rails cimaise, câbles, crochets, adhésifs structuraux, capteurs IoT). Produis 3 faits marquants récents et pertinents pour l'équipe Expert Lab, couvrant : évolutions techniques (matériaux, adhésifs, IoT), signaux marché (concurrents, appels d'offres musées / galeries), et actualité réglementaire (normes, conservation, sécurité). Chaque fait doit être concret et exploitable. Réponds UNIQUEMENT en JSON strict, tableau de 3 objets avec les clés : category ('technique'|'marche'|'reglementaire'), impact ('faible'|'moyen'|'fort'), title (max 120 car.), summary (2-3 phrases), source_label (nom court de la source si connue, sinon 'Analyse KOA').`;

    const USER = `Faits déjà en base (à ne pas répéter) :\n${seen || "(aucun)"}\n\nGénère 3 nouveaux faits marquants distincts.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: USER }],
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429) throw new Error("Limite d'appels IA atteinte, réessayez plus tard.");
    if (res.status === 402) throw new Error("Crédits Lovable AI épuisés.");
    if (!res.ok) throw new Error(`IA indisponible (${res.status})`);
    const json: any = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "[]";

    let items: any[] = [];
    try {
      const parsed = JSON.parse(content);
      items = Array.isArray(parsed) ? parsed : (parsed.items ?? parsed.highlights ?? parsed.data ?? []);
    } catch {
      throw new Error("Réponse IA illisible.");
    }

    const valid = items
      .filter((i) => i && typeof i.title === "string" && typeof i.summary === "string")
      .slice(0, 5)
      .map((i) => ({
        category: ["technique", "marche", "reglementaire", "interne"].includes(i.category) ? i.category : "marche",
        impact: ["faible", "moyen", "fort"].includes(i.impact) ? i.impact : "moyen",
        title: String(i.title).slice(0, 280),
        summary: String(i.summary).slice(0, 3800),
        source_label: i.source_label ? String(i.source_label).slice(0, 280) : "Analyse KOA",
        created_by: context.userId,
      }));

    if (valid.length === 0) throw new Error("L'IA n'a retourné aucun fait exploitable.");

    const { error } = await supabaseAdmin.from("highlights").insert(valid);
    if (error) throw new Error(error.message);
    return { inserted: valid.length };
  });

// ---------------------------------------------------------------------------
// Benchmark concurrentiel
// ---------------------------------------------------------------------------

export const listCompetitors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertExpertOrAdmin(context.userId);
    const { data, error } = await context.supabase
      .from("market_competitors").select("*")
      .order("is_koa", { ascending: false })
      .order("competitor_name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const levelEnum = z.enum(["non", "partiel", "oui"]);

export const upsertCompetitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid().optional(),
      competitor_name: z.string().min(1).max(200),
      segment: z.string().min(1).max(300),
      is_koa: z.boolean().default(false),
      antivol_renforce: levelEnum.default("non"),
      eclairage_integre: levelEnum.default("non"),
      charge_lourde: levelEnum.default("non"),
      instruments_mesure: levelEnum.default("non"),
      configurateur_digital: levelEnum.default("non"),
      notes: z.string().max(2000).optional(),
      source_url: z.string().url().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertExpertOrAdmin(context.userId);
    const { id, ...rest } = data;
    const payload = { ...rest, updated_by: context.userId };
    const query = id
      ? context.supabase.from("market_competitors").update(payload).eq("id", id)
      : context.supabase.from("market_competitors").insert(payload);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Suggestions de conception & catalogue (kanban)
// ---------------------------------------------------------------------------

export const listSuggestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertExpertOrAdmin(context.userId);
    const { data, error } = await context.supabase
      .from("catalog_suggestions").select("*, highlights(title, category)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      title: z.string().min(1).max(300),
      rationale: z.string().min(1).max(4000),
      target: z.enum(["produit_physique", "catalogue_logiciel"]),
      priority: z.enum(["basse", "moyenne", "haute"]).default("moyenne"),
      linked_highlight_id: z.string().uuid().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertExpertOrAdmin(context.userId);
    const { data: row, error } = await context.supabase.from("catalog_suggestions").insert({
      ...data,
      created_by: context.userId,
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateSuggestionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["propose", "a_l_etude", "adopte", "rejete"]),
      decision_note: z.string().max(2000).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertExpertOrAdmin(context.userId);
    const isFinal = data.status === "adopte" || data.status === "rejete";
    const { error } = await context.supabase.from("catalog_suggestions").update({
      status: data.status,
      decision_note: data.decision_note ?? null,
      decided_by: isFinal ? context.userId : null,
      decided_at: isFinal ? new Date().toISOString() : null,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
