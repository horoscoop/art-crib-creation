import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Schema = z.object({
  artwork_id: z.string().uuid(),
}).passthrough();

const KNOWN = ["humidity_pct", "temperature_c", "tilt_deg", "drift_mm", "tension_n"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Gateway-Token",
  "Content-Type": "application/json",
};

export const Route = createFileRoute("/api/public/sensors/ingest")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const parsed = Schema.safeParse(body);
          if (!parsed.success) {
            return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: cors });
          }
          let payload: Record<string, any> = { ...parsed.data };

          // Optional gateway token: apply mapping if present
          const token = request.headers.get("x-gateway-token");
          if (token) {
            const { data: gw } = await supabaseAdmin
              .from("sensor_gateways").select("payload_mapping").eq("auth_token", token).maybeSingle();
            if (!gw) return new Response(JSON.stringify({ error: "Invalid gateway token" }), { status: 401, headers: cors });
            const mapping = (gw.payload_mapping ?? {}) as Record<string, string>;
            for (const [src, dst] of Object.entries(mapping)) {
              if (src in payload && !(dst in payload)) payload[dst] = payload[src];
            }
            await supabaseAdmin.from("sensor_gateways").update({ last_sync_at: new Date().toISOString(), status: "ok" }).eq("auth_token", token);
          }

          const row: Record<string, any> = { artwork_id: payload.artwork_id, source: token ? "gateway" : "iot" };
          for (const k of KNOWN) {
            const v = payload[k];
            if (v !== undefined && v !== null && !isNaN(Number(v))) row[k] = Number(v);
          }

          const { error } = await supabaseAdmin.from("sensor_readings").insert(row);
          if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
          return new Response(JSON.stringify({ ok: true }), { status: 201, headers: cors });
        } catch (e) {
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), { status: 500, headers: cors });
        }
      },
    },
  },
});
