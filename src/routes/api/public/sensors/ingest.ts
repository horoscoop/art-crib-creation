import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Schema = z.object({
  artwork_id: z.string().uuid(),
}).passthrough();

// Plausible physical ranges — anything outside this is rejected rather than
// silently stored, to avoid triggering bogus critical alerts from garbage data.
const RANGES: Record<string, [number, number]> = {
  humidity_pct: [0, 100],
  temperature_c: [-40, 80],
  tilt_deg: [-90, 90],
  drift_mm: [0, 1000],
  tension_n: [0, 100000],
};

const KNOWN = Object.keys(RANGES);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Gateway-Token",
  "Content-Type": "application/json",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

export const Route = createFileRoute("/api/public/sensors/ingest")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        try {
          // A gateway token is mandatory. Without it, anyone who guesses/leaks
          // an artwork UUID could otherwise inject arbitrary sensor readings
          // (and trigger fake critical alerts) for an artwork they don't own.
          const token = request.headers.get("x-gateway-token");
          if (!token) {
            return json({ error: "Missing X-Gateway-Token header" }, 401);
          }

          const body = await request.json();
          const parsed = Schema.safeParse(body);
          if (!parsed.success) {
            return json({ error: "Invalid payload" }, 400);
          }
          let payload: Record<string, any> = { ...parsed.data };

          const { data: gw, error: gwErr } = await supabaseAdmin
            .from("sensor_gateways")
            .select("id, owner_id, payload_mapping")
            .eq("auth_token", token)
            .maybeSingle();
          if (gwErr || !gw) {
            return json({ error: "Invalid gateway token" }, 401);
          }

          // The artwork targeted by this reading must belong to the same
          // owner as the gateway (or be explicitly mapped to it). This stops
          // a valid-but-leaked gateway token from being used to write data
          // onto an unrelated tenant's artworks.
          const { data: artwork, error: artErr } = await supabaseAdmin
            .from("artworks")
            .select("id, owner_id")
            .eq("id", payload.artwork_id)
            .maybeSingle();
          if (artErr || !artwork) {
            return json({ error: "Unknown artwork_id" }, 404);
          }
          if (artwork.owner_id !== gw.owner_id) {
            const { data: mapped } = await supabaseAdmin
              .from("gateway_artwork_map")
              .select("artwork_id")
              .eq("gateway_id", gw.id)
              .eq("artwork_id", artwork.id)
              .maybeSingle();
            if (!mapped) {
              return json({ error: "Artwork not authorized for this gateway" }, 403);
            }
          }

          // Apply field mapping (source key -> canonical key)
          const mapping = (gw.payload_mapping ?? {}) as Record<string, string>;
          for (const [src, dst] of Object.entries(mapping)) {
            if (src in payload && !(dst in payload)) payload[dst] = payload[src];
          }

          await supabaseAdmin
            .from("sensor_gateways")
            .update({ last_sync_at: new Date().toISOString(), status: "ok" })
            .eq("id", gw.id);

          const row: Record<string, any> = { artwork_id: artwork.id, source: "gateway" };
          for (const k of KNOWN) {
            const v = payload[k];
            if (v === undefined || v === null) continue;
            const n = Number(v);
            if (Number.isNaN(n)) continue;
            const [min, max] = RANGES[k];
            if (n < min || n > max) {
              return json({ error: `Field ${k} out of plausible range` }, 400);
            }
            row[k] = n;
          }

          const { error } = await supabaseAdmin.from("sensor_readings").insert(row);
          if (error) return json({ error: error.message }, 500);
          return json({ ok: true }, 201);
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "error" }, 500);
        }
      },
    },
  },
});
