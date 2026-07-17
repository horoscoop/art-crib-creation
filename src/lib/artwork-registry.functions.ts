/**
 * KOA Guardian — Registre du parc d'œuvres (module Audit, Phase 2).
 *
 * Reprend l'esprit de la vue "Parc d'Œuvres" du prototype AI Studio, mais
 * branché sur les vraies données : la vue `artwork_inspection_status`
 * (déjà créée en migration) + colonnes `artworks` (weight_kg, koa_system,
 * photo_url, artist) + décompte des alertes actives non résolues.
 *
 * À placer dans src/lib/artwork-registry.functions.ts, à côté de
 * inspections.functions.ts (même pattern createServerFn + requireSupabaseAuth).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface RegistryArtwork {
  artwork_id: string;
  title: string;
  artist: string | null;
  location: string | null;
  site: string | null;
  room: string | null;
  criticality: string | null;
  weight_kg: number;
  koa_system: string | null;
  photo_url: string | null;
  last_inspection_at: string | null;
  next_due_at: string | null;
  last_score: number | null;
  inspection_status: string; // jamais_inspecte | en_retard | echeance_proche | a_jour
  active_alerts_count: number;
}

export const listArtworkRegistry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // 1) statut d'inspection (vue existante, déjà filtrée par RLS owner_id)
    const { data: statusRows, error: statusErr } = await context.supabase
      .from("artwork_inspection_status")
      .select("*");
    if (statusErr) throw new Error(statusErr.message);

    // 2) champs complémentaires non exposés par la vue
    const { data: artworkRows, error: artworkErr } = await context.supabase
      .from("artworks")
      .select("id, artist, weight_kg, koa_system, photo_url");
    if (artworkErr) throw new Error(artworkErr.message);
    const artworkById = new Map((artworkRows ?? []).map((a) => [a.id, a]));

    // 3) décompte des alertes actives (non résolues) par œuvre
    const { data: alertRows, error: alertErr } = await context.supabase
      .from("alerts")
      .select("artwork_id")
      .eq("resolved", false);
    if (alertErr) throw new Error(alertErr.message);
    const alertCountByArtwork = new Map<string, number>();
    for (const row of alertRows ?? []) {
      alertCountByArtwork.set(row.artwork_id, (alertCountByArtwork.get(row.artwork_id) ?? 0) + 1);
    }

    const registry: RegistryArtwork[] = (statusRows ?? []).map((s) => {
      const extra = artworkById.get(s.artwork_id);
      return {
        artwork_id: s.artwork_id,
        title: s.title,
        artist: extra?.artist ?? null,
        location: s.location,
        site: s.site,
        room: s.room,
        criticality: s.criticality,
        weight_kg: extra?.weight_kg ?? 0,
        koa_system: extra?.koa_system ?? null,
        photo_url: extra?.photo_url ?? null,
        last_inspection_at: s.last_inspection_at,
        next_due_at: s.next_due_at,
        last_score: s.last_score,
        inspection_status: s.inspection_status,
        active_alerts_count: alertCountByArtwork.get(s.artwork_id) ?? 0,
      };
    });

    return registry;
  });
