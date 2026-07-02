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

export const listUsersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, organization, role, approved, created_at")
      .order("created_at", { ascending: false });
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: usersRes } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const userById = new Map(usersRes.users.map((u) => [u.id, u]));
    return (profiles ?? []).map((p) => {
      const u = userById.get(p.id);
      return {
        ...p,
        email: u?.email ?? "",
        last_sign_in_at: u?.last_sign_in_at ?? null,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
      };
    });
  });

export const ASSIGNABLE_ROLES = ["admin", "expert_koa", "conservateur", "musee", "galerie", "technicien"] as const;

export const setUserRoleAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      role: z.enum(ASSIGNABLE_ROLES),
      grant: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.grant) {
      await supabaseAdmin.from("user_roles").upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role);
    }
    return { ok: true };
  });

export const setUserApprovedAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid(), approved: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("profiles").update({ approved: data.approved }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("Impossible de supprimer son propre compte.");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAllArtworksAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: works } = await supabaseAdmin
      .from("artworks")
      .select("id, title, artist, location, weight_kg, owner_id, max_humidity, max_tilt_deg, max_drift_mm, created_at")
      .order("created_at", { ascending: false });
    const { data: usersRes } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const emailById = new Map(usersRes.users.map((u) => [u.id, u.email ?? ""]));
    return (works ?? []).map((w) => ({ ...w, owner_email: emailById.get(w.owner_id) ?? "" }));
  });

export const updateArtworkThresholdsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid(),
      max_humidity: z.number().min(0).max(100),
      max_tilt_deg: z.number().min(0).max(45),
      max_drift_mm: z.number().min(0).max(100),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("artworks").update({
      max_humidity: data.max_humidity,
      max_tilt_deg: data.max_tilt_deg,
      max_drift_mm: data.max_drift_mm,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listConnectionLogsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("connection_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const listOwnersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: usersRes } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    return usersRes.users.map((u) => ({ id: u.id, email: u.email ?? "" }));
  });

export const clearConnectionLogsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("connection_logs")
      .delete()
      .gt("created_at", "1970-01-01");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Insère un événement de connexion coté serveur (fallback fiable, RLS bypass).
export const logConnectionEventAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    event: z.string().max(40),
    user_agent: z.string().max(500).optional().nullable(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const email = context.claims?.email ?? null;
    await supabaseAdmin.from("connection_logs").insert({
      user_id: context.userId,
      email,
      event: data.event,
      user_agent: data.user_agent ?? null,
    });
    return { ok: true };
  });

// ========== Expertises ==========
export const listExpertisesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("expertises")
      .select("*, artworks(title, location, owner_id)")
      .order("performed_at", { ascending: false })
      .limit(500);
    const { data: usersRes } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const emailById = new Map(usersRes.users.map((u) => [u.id, u.email ?? ""]));
    return (data ?? []).map((e: any) => ({
      ...e,
      expert_email: emailById.get(e.expert_id) ?? "",
      owner_email: emailById.get(e.artworks?.owner_id) ?? "",
    }));
  });

export const deleteExpertiseAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("expertises").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ========== KOA Vision diagnostics ==========
export const listVisionDiagnosticsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("vision_diagnostics")
      .select("id, user_id, artwork_id, mode, scoring_securite, kit_recommande, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    const { data: usersRes } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const emailById = new Map(usersRes.users.map((u) => [u.id, u.email ?? ""]));
    return (data ?? []).map((d: any) => ({ ...d, user_email: emailById.get(d.user_id) ?? "" }));
  });

export const getVisionDiagnosticAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("vision_diagnostics").select("*").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("Diagnostic introuvable");
    return row;
  });

export const deleteVisionDiagnosticAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("vision_diagnostics").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ========== Cimaise conversations ==========
export const cimaiseStatsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("cimaise_messages")
      .select("user_id, role, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    const { data: usersRes } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const emailById = new Map(usersRes.users.map((u) => [u.id, u.email ?? ""]));
    const perUser = new Map<string, { user_id: string; email: string; questions: number; answers: number; last_at: string }>();
    for (const row of data ?? []) {
      const key = row.user_id;
      const cur = perUser.get(key) ?? { user_id: key, email: emailById.get(key) ?? "", questions: 0, answers: 0, last_at: row.created_at };
      if (row.role === "user") cur.questions++;
      else cur.answers++;
      if (row.created_at > cur.last_at) cur.last_at = row.created_at;
      perUser.set(key, cur);
    }
    const totals = {
      messages: data?.length ?? 0,
      questions: (data ?? []).filter((r) => r.role === "user").length,
      users: perUser.size,
    };
    return { totals, per_user: Array.from(perUser.values()).sort((a, b) => b.questions - a.questions) };
  });

export const listCimaiseMessagesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: rows } = await supabaseAdmin
      .from("cimaise_messages")
      .select("id, role, content, created_at")
      .eq("user_id", data.user_id)
      .order("created_at", { ascending: true })
      .limit(500);
    return rows ?? [];
  });

export const deleteCimaiseUserHistoryAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("cimaise_messages").delete().eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
