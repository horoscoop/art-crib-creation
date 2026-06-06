import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdminOrExpert(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "expert_koa"]);
  if (!data || data.length === 0) throw new Error("Accès réservé administrateurs / experts KOA");
}

export const getSupervisionDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrExpert(context.userId);

    const [worksRes, alertsRes, gatewaysRes, readingsRes, eventsRes, inspectionsRes] = await Promise.all([
      supabaseAdmin.from("artworks").select("id, title, criticality, site, room, location, last_check_at, owner_id"),
      supabaseAdmin.from("alerts").select("id, artwork_id, severity, kind, message, created_at, resolved").order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("sensor_gateways").select("id, name, status, last_sync_at"),
      supabaseAdmin.from("sensor_readings").select("artwork_id, recorded_at").order("recorded_at", { ascending: false }).limit(500),
      supabaseAdmin.from("trace_events").select("id, artwork_id, event_type, created_at").order("created_at", { ascending: false }).limit(30),
      supabaseAdmin.from("inspections").select("id, artwork_id, next_due_at, performed_at").not("next_due_at", "is", null),
    ]);

    const works = worksRes.data ?? [];
    const alerts = alertsRes.data ?? [];
    const gateways = gatewaysRes.data ?? [];
    const readings = readingsRes.data ?? [];
    const events = eventsRes.data ?? [];
    const inspections = inspectionsRes.data ?? [];

    const lastSeenByArtwork = new Map<string, string>();
    for (const r of readings) {
      if (!lastSeenByArtwork.has(r.artwork_id)) lastSeenByArtwork.set(r.artwork_id, r.recorded_at);
    }

    const activeAlerts = alerts.filter((a) => !a.resolved);
    const now = Date.now();
    const overdueInspections = inspections.filter((i) => i.next_due_at && new Date(i.next_due_at).getTime() < now);

    const workTitleById = new Map(works.map((w) => [w.id, w.title]));

    return {
      counts: {
        artworks: works.length,
        criticalAlerts: activeAlerts.filter((a) => a.severity === "critical").length,
        vigilanceAlerts: activeAlerts.filter((a) => a.severity === "vigilance").length,
        gatewaysOnline: gateways.filter((g) => g.status === "online").length,
        gatewaysTotal: gateways.length,
        overdueInspections: overdueInspections.length,
        critique: works.filter((w) => w.criticality === "critique").length,
      },
      gateways,
      recentAlerts: activeAlerts.slice(0, 10).map((a) => ({ ...a, artwork_title: workTitleById.get(a.artwork_id) ?? "—" })),
      recentEvents: events.map((e) => ({ ...e, artwork_title: workTitleById.get(e.artwork_id) ?? "—" })),
      silentArtworks: works
        .map((w) => ({ ...w, last_seen: lastSeenByArtwork.get(w.id) ?? null }))
        .filter((w) => !w.last_seen || (now - new Date(w.last_seen).getTime()) > 7 * 24 * 3600 * 1000)
        .slice(0, 10),
      overdueInspections: overdueInspections
        .slice(0, 10)
        .map((i) => ({ ...i, artwork_title: workTitleById.get(i.artwork_id) ?? "—" })),
    };
  });
