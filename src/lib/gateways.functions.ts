import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ProtocolEnum = z.enum(["webhook", "http", "mqtt"]);

export const listGateways = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isA } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    const q = supabaseAdmin.from("sensor_gateways").select("*, gateway_artwork_map(artwork_id, sensor_field_map)").order("created_at", { ascending: false });
    const { data } = isA ? await q : await q.eq("owner_id", context.userId);
    return data ?? [];
  });

export const upsertGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(120),
      protocol: ProtocolEnum,
      endpoint: z.string().max(500).optional().nullable(),
      payload_mapping: z.record(z.string(), z.string()).default({}),
      sync_interval_s: z.number().int().min(30).max(86400).default(300),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await supabaseAdmin.from("sensor_gateways").update({
        name: data.name, protocol: data.protocol, endpoint: data.endpoint,
        payload_mapping: data.payload_mapping, sync_interval_s: data.sync_interval_s,
      }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("sensor_gateways").insert({
      owner_id: context.userId,
      name: data.name, protocol: data.protocol, endpoint: data.endpoint,
      payload_mapping: data.payload_mapping, sync_interval_s: data.sync_interval_s,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row!.id };
  });

export const deleteGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await supabaseAdmin.from("sensor_gateways").delete().eq("id", data.id);
    return { ok: true };
  });

export const mapGatewayToArtwork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      gateway_id: z.string().uuid(),
      artwork_id: z.string().uuid(),
      sensor_field_map: z.record(z.string(), z.string()).default({}),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("gateway_artwork_map")
      .upsert(data, { onConflict: "gateway_id,artwork_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
