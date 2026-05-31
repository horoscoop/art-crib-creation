import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import ExcelJS from "exceljs";

async function isAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  return !!data;
}

async function fetchClientData(ownerId: string) {
  const [{ data: artworks }, { data: profile }] = await Promise.all([
    supabaseAdmin.from("artworks").select("*").eq("owner_id", ownerId).order("created_at"),
    supabaseAdmin.from("profiles").select("*").eq("id", ownerId).maybeSingle(),
  ]);
  const ids = (artworks ?? []).map((a) => a.id);
  const [{ data: readings }, { data: alerts }, { data: maint }] = await Promise.all([
    ids.length ? supabaseAdmin.from("sensor_readings").select("*").in("artwork_id", ids).order("recorded_at", { ascending: false }) : Promise.resolve({ data: [] }),
    ids.length ? supabaseAdmin.from("alerts").select("*").in("artwork_id", ids).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    ids.length ? supabaseAdmin.from("maintenance_logs").select("*").in("artwork_id", ids).order("performed_at", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  return { artworks: artworks ?? [], profile, readings: readings ?? [], alerts: alerts ?? [], maint: maint ?? [] };
}

export const exportClientReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      ownerId: z.string().uuid().optional(),
      format: z.enum(["pdf", "xlsx"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const targetOwner = data.ownerId ?? context.userId;
    if (targetOwner !== context.userId && !(await isAdmin(context.userId))) {
      throw new Error("Accès refusé");
    }
    const { artworks, profile, readings, alerts, maint } = await fetchClientData(targetOwner);

    if (data.format === "xlsx") {
      const wb = new ExcelJS.Workbook();
      wb.creator = "KOA Guardian";
      const wA = wb.addWorksheet("Œuvres");
      wA.columns = [
        { header: "Titre", key: "title", width: 30 },
        { header: "Artiste", key: "artist", width: 22 },
        { header: "Lieu", key: "location", width: 22 },
        { header: "Poids (kg)", key: "weight_kg", width: 12 },
        { header: "Système", key: "koa_system", width: 14 },
        { header: "Pose", key: "install_date", width: 12 },
        { header: "Humidité max (%)", key: "max_humidity", width: 16 },
        { header: "Inclinaison max (°)", key: "max_tilt_deg", width: 16 },
        { header: "Fluage max (mm)", key: "max_drift_mm", width: 16 },
      ];
      artworks.forEach((a) => wA.addRow(a));

      const wR = wb.addWorksheet("Mesures");
      wR.columns = [
        { header: "Œuvre", key: "title", width: 30 },
        { header: "Date", key: "recorded_at", width: 22 },
        { header: "Humidité (%)", key: "humidity_pct", width: 14 },
        { header: "Température (°C)", key: "temperature_c", width: 16 },
        { header: "Inclinaison (°)", key: "tilt_deg", width: 14 },
        { header: "Fluage (mm)", key: "drift_mm", width: 14 },
        { header: "Tension (N)", key: "tension_n", width: 14 },
        { header: "Source", key: "source", width: 12 },
      ];
      const titleById = new Map(artworks.map((a) => [a.id, a.title]));
      readings.forEach((r) => wR.addRow({ ...r, title: titleById.get(r.artwork_id) ?? "" }));

      const wAl = wb.addWorksheet("Alertes");
      wAl.columns = [
        { header: "Œuvre", key: "title", width: 30 },
        { header: "Date", key: "created_at", width: 22 },
        { header: "Type", key: "kind", width: 14 },
        { header: "Gravité", key: "severity", width: 14 },
        { header: "Message", key: "message", width: 60 },
        { header: "Résolue", key: "resolved", width: 10 },
      ];
      alerts.forEach((a) => wAl.addRow({ ...a, title: titleById.get(a.artwork_id) ?? "" }));

      const wM = wb.addWorksheet("Maintenance");
      wM.columns = [
        { header: "Œuvre", key: "title", width: 30 },
        { header: "Date", key: "performed_at", width: 22 },
        { header: "Type", key: "kind", width: 16 },
        { header: "Constat", key: "description", width: 60 },
      ];
      maint.forEach((m) => wM.addRow({ ...m, title: titleById.get(m.artwork_id) ?? "" }));

      const buf = await wb.xlsx.writeBuffer();
      return {
        filename: `koa-rapport-${(profile?.organization ?? "client").replace(/\s+/g, "-").toLowerCase()}.xlsx`,
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        base64: Buffer.from(buf).toString("base64"),
      };
    }

    // PDF
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);
    const titleById = new Map(artworks.map((a) => [a.id, a.title]));

    const newPage = () => pdf.addPage([595, 842]);
    let page = newPage();
    let y = 800;
    const line = (text: string, opts: { bold?: boolean; size?: number; color?: [number, number, number] } = {}) => {
      const size = opts.size ?? 10;
      if (y < 60) { page = newPage(); y = 800; }
      page.drawText(text.slice(0, 95), { x: 50, y, size, font: opts.bold ? fontB : font, color: rgb(...(opts.color ?? [0.1, 0.1, 0.1])) });
      y -= size + 4;
    };

    // Cover
    page.drawText("KOA Guardian", { x: 50, y: 780, size: 28, font: fontB });
    page.drawText("Rapport de conservation", { x: 50, y: 750, size: 14, font });
    page.drawText(`Client : ${profile?.organization ?? profile?.full_name ?? "—"}`, { x: 50, y: 700, size: 11, font });
    page.drawText(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, { x: 50, y: 684, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(`${artworks.length} œuvre(s) · ${alerts.filter((a) => !a.resolved).length} alerte(s) active(s)`, { x: 50, y: 668, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
    y = 620;

    for (const a of artworks) {
      if (y < 200) { page = newPage(); y = 800; }
      line(a.title, { bold: true, size: 14 });
      line(`${a.artist ?? "Artiste inconnu"} · ${a.location ?? "—"}`, { color: [0.4, 0.4, 0.4] });
      line(`Poids ${a.weight_kg} kg · Système ${a.koa_system ?? "—"} · Pose ${a.install_date ?? "—"}`);
      line(`Seuils : humidité ${a.max_humidity}% · inclinaison ${a.max_tilt_deg}° · fluage ${a.max_drift_mm}mm`);
      const lastR = readings.find((r) => r.artwork_id === a.id);
      if (lastR) line(`Dernier relevé : H ${lastR.humidity_pct ?? "—"}% · T ${lastR.temperature_c ?? "—"}°C · I ${lastR.tilt_deg ?? "—"}°`);
      const aw = alerts.filter((al) => al.artwork_id === a.id && !al.resolved);
      if (aw.length) {
        line(`Alertes actives : ${aw.length}`, { bold: true, color: [0.8, 0.2, 0.1] });
        aw.slice(0, 3).forEach((al) => line(`  · ${al.message}`, { size: 9 }));
      }
      y -= 8;
    }

    if (alerts.length) {
      page = newPage(); y = 800;
      line("Historique des alertes", { bold: true, size: 16 });
      y -= 8;
      for (const al of alerts.slice(0, 60)) {
        line(`${new Date(al.created_at).toLocaleDateString("fr-FR")} · ${titleById.get(al.artwork_id) ?? ""} · ${al.severity}`, { bold: true, size: 9 });
        line(`  ${al.message}`, { size: 9, color: [0.3, 0.3, 0.3] });
      }
    }

    const bytes = await pdf.save();
    return {
      filename: `koa-rapport-${(profile?.organization ?? "client").replace(/\s+/g, "-").toLowerCase()}.pdf`,
      mime: "application/pdf",
      base64: Buffer.from(bytes).toString("base64"),
    };
  });
