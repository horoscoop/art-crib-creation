import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Accès réservé aux administrateurs");
}

const TABLES = [
  "profiles", "user_roles", "artworks", "sensor_readings", "alerts",
  "maintenance_logs", "inspections", "expertises", "attachments",
  "hanging_systems", "sensor_gateways", "gateway_artwork_map",
  "connection_logs", "backups",
] as const;

export const createBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const dump: Record<string, unknown[]> = {};
    let total = 0;
    for (const t of TABLES) {
      const { data, error } = await supabaseAdmin.from(t).select("*");
      if (error) throw new Error(`Erreur sur ${t} : ${error.message}`);
      dump[t] = data ?? [];
      total += dump[t].length;
    }
    const payload = JSON.stringify({
      generated_at: new Date().toISOString(),
      generated_by: context.userId,
      tables: dump,
    }, null, 2);
    const bytes = new TextEncoder().encode(payload);
    const date = new Date().toISOString().replace(/[:.]/g, "-");
    const path = `${date}.json`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("db-backups").upload(path, bytes, { contentType: "application/json", upsert: false });
    if (upErr) throw new Error(upErr.message);
    const { data: row, error: insErr } = await supabaseAdmin.from("backups").insert({
      created_by: context.userId,
      storage_path: path,
      size_bytes: bytes.byteLength,
      tables_count: TABLES.length,
      rows_count: total,
    }).select().single();
    if (insErr) throw new Error(insErr.message);
    return row;
  });

export const listBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin.from("backups").select("*").order("created_at", { ascending: false });
    return data ?? [];
  });

export const downloadBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row } = await supabaseAdmin.from("backups").select("storage_path").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Sauvegarde introuvable");
    const { data: signed } = await supabaseAdmin.storage.from("db-backups")
      .createSignedUrl(row.storage_path, 600);
    if (!signed) throw new Error("Lien indisponible");
    return { url: signed.signedUrl };
  });

export const deleteBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row } = await supabaseAdmin.from("backups").select("storage_path").eq("id", data.id).maybeSingle();
    if (row) await supabaseAdmin.storage.from("db-backups").remove([row.storage_path]);
    await supabaseAdmin.from("backups").delete().eq("id", data.id);
    return { ok: true };
  });
