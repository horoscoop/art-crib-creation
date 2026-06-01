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

export const createExpertise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      artwork_id: z.string().uuid(),
      type: z.enum(["installation", "audit", "incident", "transfert"]).default("audit"),
      rapport: z.string().min(1).max(20000),
      recommandations: z.string().max(10000).optional(),
      charge_mesuree_kg: z.number().min(0).max(10000).optional(),
      kit_recommande: z.string().max(200).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertExpertOrAdmin(context.userId);
    const { data: row, error } = await context.supabase.from("expertises").insert({
      artwork_id: data.artwork_id,
      expert_id: context.userId,
      type: data.type,
      rapport: data.rapport,
      recommandations: data.recommandations ?? null,
      charge_mesuree_kg: data.charge_mesuree_kg ?? null,
      kit_recommande: data.kit_recommande ?? null,
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listExpertisesForArtwork = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ artwork_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("expertises").select("*").eq("artwork_id", data.artwork_id)
      .order("performed_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listAllExpertises = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("expertises")
      .select("*, artworks(title, location, owner_id)")
      .order("performed_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
