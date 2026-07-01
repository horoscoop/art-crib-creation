import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SignaturesSchema = z.object({
  fatigue: z.enum(["ok", "mineur", "modere", "majeur", "critique"]).optional(),
  corrosion: z.enum(["ok", "mineur", "modere", "majeur", "critique"]).optional(),
  support: z.enum(["ok", "mineur", "modere", "majeur", "critique"]).optional(),
  fluage: z.enum(["ok", "mineur", "modere", "majeur", "critique"]).optional(),
  sismique: z.enum(["ok", "mineur", "modere", "majeur", "critique"]).optional(),
}).partial();

const SEVERITY_WEIGHTS: Record<string, number> = { ok: 0, mineur: 0.1, modere: 0.3, majeur: 0.6, critique: 1 };

function computeScore(signatures: z.infer<typeof SignaturesSchema>): number {
  const vals = Object.values(signatures).filter((v): v is string => !!v);
  if (!vals.length) return 0;
  const weights = vals.map((v) => SEVERITY_WEIGHTS[v] ?? 0);
  // Score = average severity (0 = parfait, 1 = critique généralisé),
  // relevé au max de la pire signature pour éviter qu'un critique unique soit dilué.
  const avg = weights.reduce((a, b) => a + b, 0) / weights.length;
  const worst = Math.max(...weights);
  return Math.min(1, Math.max(avg, worst * 0.6));
}

export const createInspection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      artwork_id: z.string().uuid(),
      period_type: z.enum(["monthly", "quarterly", "annual", "ad_hoc"]).default("ad_hoc"),
      notes: z.string().max(5000).optional(),
      signatures: SignaturesSchema.default({}),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const score = computeScore(data.signatures);
    const { data: row, error } = await supabase.from("inspections").insert({
      artwork_id: data.artwork_id,
      inspector_id: userId,
      period_type: data.period_type,
      notes: data.notes ?? null,
      signatures: data.signatures,
      score_global: score,
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listInspectionsForArtwork = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ artwork_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("inspections").select("*").eq("artwork_id", data.artwork_id)
      .order("performed_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listAllInspections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("inspections")
      .select("*, artworks(title, owner_id, location)")
      .order("performed_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
