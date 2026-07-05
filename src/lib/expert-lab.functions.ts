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
