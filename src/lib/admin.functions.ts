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
      .select("id, full_name, organization, role, created_at")
      .order("created_at", { ascending: false });
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: usersRes } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const emailById = new Map(usersRes.users.map((u) => [u.id, u.email ?? ""]));
    return (profiles ?? []).map((p) => ({
      ...p,
      email: emailById.get(p.id) ?? "",
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
    }));
  });

export const setUserRoleAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      role: z.enum(["admin", "conservateur"]),
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

