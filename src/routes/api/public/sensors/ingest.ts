import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Schema = z.object({
  artwork_id: z.string().uuid(),
  humidity_pct: z.number().min(0).max(100).optional(),
  temperature_c: z.number().min(-40).max(80).optional(),
  tilt_deg: z.number().min(-90).max(90).optional(),
  drift_mm: z.number().min(0).max(1000).optional(),
  tension_n: z.number().min(0).max(100000).optional(),
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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
            return new Response(JSON.stringify({ error: "Invalid payload", details: parsed.error.format() }),
              { status: 400, headers: cors });
          }
          const { artwork_id, ...metrics } = parsed.data;
          const { error } = await supabaseAdmin.from("sensor_readings").insert({
            artwork_id, ...metrics, source: "iot",
          });
          if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
          return new Response(JSON.stringify({ ok: true }), { status: 201, headers: cors });
        } catch (e) {
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }),
            { status: 500, headers: cors });
        }
      },
    },
  },
});
