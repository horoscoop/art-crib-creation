/**
 * KOA Guardian — Outil d'aide à la conception d'accroche (onglet admin).
 * Interroge le catalogue KOA existant (table hanging_systems) et propose
 * les systèmes adaptés au poids et au type de mur, en réutilisant la même
 * règle de sécurité que Cimaise (facteur 3-4x le poids de l'œuvre).
 *
 * À placer dans src/lib/hanging-systems-advisor.functions.ts
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

export interface HangingSystemRecommendation {
  id: string;
  code: string;
  name: string;
  description: string | null;
  max_weight_kg: number | null;
  wall_types: string[];
  maintenance_interval_years: number | null;
  illustration_url: string | null;
  wall_match: boolean;
  safety_margin: number | null; // max_weight_kg / poids demandé
  safety_level: "insuffisant" | "vigilance" | "conforme" | "indetermine";
  no_drilling: boolean;
}

export const recommendHangingSystemsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      weight_kg: z.number().min(0.1).max(2000),
      wall_type: z.string().max(60).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: systems, error } = await supabaseAdmin
      .from("hanging_systems")
      .select("*")
      .order("max_weight_kg", { ascending: true });
    if (error) throw new Error(error.message);

    const wallQuery = data.wall_type?.trim().toLowerCase();

    const results: HangingSystemRecommendation[] = (systems ?? []).map((s) => {
      const maxW = s.max_weight_kg as number | null;
      const wallTypes = (s.wall_types as string[] | null) ?? [];
      const wallMatch = !wallQuery || wallTypes.some((w) => w.toLowerCase().includes(wallQuery));
      const margin = maxW ? maxW / data.weight_kg : null;

      let safety: HangingSystemRecommendation["safety_level"] = "indetermine";
      if (margin !== null) {
        if (margin < 1) safety = "insuffisant";
        else if (margin < 3) safety = "vigilance"; // sous le facteur 3-4x recommandé par Cimaise
        else safety = "conforme";
      }

      const noDrilling = /sans perçage/i.test(s.description ?? "");

      return {
        id: s.id,
        code: s.code,
        name: s.name,
        description: s.description,
        max_weight_kg: maxW,
        wall_types: wallTypes,
        maintenance_interval_years: s.maintenance_interval_years,
        illustration_url: s.illustration_url,
        wall_match: wallMatch,
        safety_margin: margin,
        safety_level: safety,
        no_drilling: noDrilling,
      };
    });

    // Tri : systèmes conformes + compatibles avec le mur d'abord,
    // puis par marge de sécurité croissante (le plus juste avant le surdimensionné).
    results.sort((a, b) => {
      const score = (r: HangingSystemRecommendation) =>
        (r.safety_level === "insuffisant" ? 2 : 0) +
        (r.wall_match ? 0 : 1);
      const sa = score(a), sb = score(b);
      if (sa !== sb) return sa - sb;
      return (a.safety_margin ?? Infinity) - (b.safety_margin ?? Infinity);
    });

    return results;
  });
