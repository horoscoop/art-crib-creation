import { supabase } from "@/integrations/supabase/client";

export type Severity = "ok" | "vigilance" | "critical";

export function computeSeverity(activeAlerts: Array<{ severity: string }>): Severity {
  if (activeAlerts.some((a) => a.severity === "critical")) return "critical";
  if (activeAlerts.length > 0) return "vigilance";
  return "ok";
}

/** Get a short-lived signed URL for a private artwork photo. */
export async function signedPhoto(path: string | null | undefined, expiresIn = 3600) {
  if (!path) return null;
  const { data } = await supabase.storage.from("artwork-photos").createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
