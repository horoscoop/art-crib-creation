import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Récupère toutes les données nécessaires au rapport de conformité KOA.
 * Réservé aux administrateurs.
 */
export const getComplianceData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      start_date: z.string(),
      end_date: z.string(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Réservé aux administrateurs");

    const start = data.start_date;
    const end = data.end_date;

    const [artworksRes, inspectionsRes, alertsRes, expertisesRes, maintenanceRes, planningRes] = await Promise.all([
      supabase.from("artworks").select("id, title, artist, location, site, room, weight_kg, koa_system, install_date, nfc_id, criticality").order("title"),
      supabase.from("inspections").select("id, artwork_id, performed_at, period_type, score_global, signatures, notes, inspector_id, next_due_at, artworks(title)")
        .gte("performed_at", start).lte("performed_at", end).order("performed_at", { ascending: false }),
      supabase.from("alerts").select("id, artwork_id, kind, severity, message, measured_value, threshold_value, created_at, resolved, resolved_at, artworks(title)")
        .gte("created_at", start).lte("created_at", end).order("created_at", { ascending: false }),
      supabase.from("expertises").select("id, artwork_id, performed_at, type, expert_name, kit_recommande, charge_mesuree_kg, rapport, recommandations, artworks(title)")
        .gte("performed_at", start).lte("performed_at", end).order("performed_at", { ascending: false }),
      supabase.from("maintenance_logs").select("id, artwork_id, performed_at, kind, description, artworks(title)")
        .gte("performed_at", start).lte("performed_at", end).order("performed_at", { ascending: false }),
      supabase.from("artwork_inspection_status" as never).select("artwork_id, title, next_due_at, last_score, last_inspection_at, inspection_status"),
    ]);

    if (artworksRes.error) throw new Error(artworksRes.error.message);

    const artworks = artworksRes.data ?? [];
    const inspections = inspectionsRes.data ?? [];
    const alerts = alertsRes.data ?? [];
    const expertises = expertisesRes.data ?? [];
    const maintenance = maintenanceRes.data ?? [];
    const planning = (planningRes.data ?? []) as Array<{
      artwork_id: string;
      title: string;
      next_due_at: string | null;
      last_score: number | null;
      last_inspection_at: string | null;
      inspection_status: string;
    }>;

    const critical = alerts.filter((a: any) => a.severity === "critical");
    const criticalResolved = critical.filter((a: any) => a.resolved);
    const inspectedIds = new Set(inspections.map((i: any) => i.artwork_id));
    const scoreValues = planning.map((p) => p.last_score).filter((v): v is number => v != null);
    const avgScore = scoreValues.length ? scoreValues.reduce((a, b) => a + (1 - b) * 100, 0) / scoreValues.length : 100;

    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30 * 6);

    const recommendations = planning
      .map((p) => {
        if (p.last_score != null && p.last_score >= 0.7) {
          return { title: p.title, level: "urgent", text: "Intervention urgente recommandée — expertise dans les 30 jours." };
        }
        if (p.last_score != null && p.last_score >= 0.5) {
          return { title: p.title, level: "renforcee", text: "Surveillance renforcée — inspection mensuelle conseillée." };
        }
        if (!p.last_inspection_at || new Date(p.last_inspection_at) < sixMonthsAgo) {
          return { title: p.title, level: "initiale", text: "Inspection initiale à planifier (> 6 mois sans contrôle)." };
        }
        return null;
      })
      .filter((r): r is { title: string; level: string; text: string } => !!r);

    return {
      summary: {
        totalArtworks: artworks.length,
        healthScore: Math.round(avgScore),
        criticalAlerts: critical.length,
        criticalResolved: criticalResolved.length,
        inspectionCoverage: artworks.length ? Math.round((inspectedIds.size / artworks.length) * 100) : 0,
        expertisesCount: expertises.length,
        needsAttention: planning.filter((p) => p.last_score != null && p.last_score >= 0.5).length,
      },
      artworks,
      inspections,
      alerts,
      expertises,
      maintenance,
      recommendations,
    };
  });
