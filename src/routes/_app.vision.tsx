import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Eye, Upload, Loader2, Link2, FileDown, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { analyzeKoaVision, type VisionReport } from "@/lib/vision.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import jsPDF from "jspdf";

export const Route = createFileRoute("/_app/vision")({
  head: () => ({ meta: [{ title: "KOA Vision — Diagnostic IA" }] }),
  component: VisionPage,
});

type ImgItem = { label: string; data_url: string };

const KIT_LABELS: Record<string, string> = {
  kit_magnetique_n52_bidirectionnel: "Kit magnétique néodyme N52 bidirectionnel (zéro perçage)",
  kit_cimaise_standard: "Cimaise KOA standard",
  kit_cimaise_renforcee: "Cimaise KOA renforcée",
  kit_ryman_allonge: "Kit Ryman allongé (charges lourdes)",
  kit_taquets_mobiles_bois: "Taquets mobiles pour support bois",
  kit_scellement_chimique: "Scellement chimique (pierre/béton)",
  kit_adhesif_structural: "Adhésif structural (à éviter en milieu humide)",
};

function scoreColor(score: number) {
  if (score >= 85) return "text-emerald-600 border-emerald-600";
  if (score >= 60) return "text-amber-600 border-amber-600";
  return "text-red-600 border-red-600";
}

const LOADER_MESSAGES = [
  "Analyse du support mural…",
  "Estimation de la charge et coefficient ×4…",
  "Vérification des risques (humidité, vibrations)…",
  "Sélection du kit KOA le plus adapté…",
  "Génération du rapport technique…",
];

function VisionPage() {
  const run = useServerFn(analyzeKoaVision);
  const { user } = useAuth();
  const [mode, setMode] = useState<"recommendation" | "diagnostic">("recommendation");
  const [images, setImages] = useState<ImgItem[]>([]);
  const [ctx, setCtx] = useState({ weight_kg: "", height_m: "", age_years: "", location: "", notes: "" });
  const [artworkId, setArtworkId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loaderStep, setLoaderStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<VisionReport | null>(null);

  useEffect(() => {
    if (!loading) { setLoaderStep(0); return; }
    const id = setInterval(() => setLoaderStep((s) => (s + 1) % LOADER_MESSAGES.length), 2200);
    return () => clearInterval(id);
  }, [loading]);

  const { data: artworks = [] } = useQuery({
    queryKey: ["artworks-mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("artworks").select("id, title, location").order("title");
      return data ?? [];
    },
  });

  const addFiles = async (files: FileList | null, defaultLabel: string) => {
    if (!files?.length) return;
    const out: ImgItem[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 5_000_000) { toast.error(`${f.name} > 5 Mo`); continue; }
      const data_url = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      out.push({ label: defaultLabel, data_url });
    }
    setImages((prev) => [...prev, ...out].slice(0, 3));
  };

  const submit = async () => {
    if (!images.length) return toast.error("Ajoutez au moins une photo.");
    setLoading(true);
    setReport(null);
    try {
      const r = await run({
        data: {
          mode,
          images,
          context: {
            weight_kg: ctx.weight_kg ? Number(ctx.weight_kg) : null,
            height_m: ctx.height_m ? Number(ctx.height_m) : null,
            age_years: ctx.age_years ? Number(ctx.age_years) : null,
            location: ctx.location || null,
            notes: ctx.notes || null,
          },
        },
      });
      setReport(r.report);
    } catch (e: any) {
      toast.error(e.message || "Analyse indisponible");
    } finally {
      setLoading(false);
    }
  };

  const attachToArtwork = async () => {
    if (!artworkId || !report) return toast.error("Choisissez une œuvre.");
    setSaving(true);
    try {
      const kind = mode === "recommendation" ? "vision_recommandation" : "vision_diagnostic";
      const header = `[KOA Vision — Scoring ${report.scoring_securite}%]`;
      const body = `${header}\n\nKit : ${report.kit_recommande ?? "—"}\nAlertes : ${report.alertes.join(" · ") || "aucune"}\n\n${report.rapport_md}`;
      const { error } = await supabase.from("maintenance_logs").insert({
        artwork_id: artworkId,
        performed_by: user?.id ?? null,
        kind,
        description: body,
      });
      if (error) throw error;
      for (const img of images) {
        try {
          const blob = await (await fetch(img.data_url)).blob();
          const ext = blob.type.split("/")[1] || "jpg";
          const path = `${artworkId}/vision-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
          const { error: upErr } = await supabase.storage.from("artwork-attachments").upload(path, blob, { contentType: blob.type });
          if (upErr) continue;
          await supabase.from("attachments").insert({
            artwork_id: artworkId, storage_path: path,
            filename: `koa-vision-${img.label}.${ext}`,
            mime_type: blob.type, size_bytes: blob.size,
          });
        } catch {}
      }
      toast.success("Rapport rattaché à la fiche");
    } catch (e: any) {
      toast.error(e.message || "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const exportCertificate = () => {
    if (!report) return;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210;
    let y = 20;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("KOA VISION · CERTIFICAT ÉTAT ZÉRO", 20, y);
    doc.setLineWidth(0.2);
    doc.line(20, y + 3, W - 20, y + 3);
    y += 15;

    doc.setFontSize(20);
    doc.text(mode === "recommendation" ? "Recommandation d'accrochage" : "Diagnostic d'état", 20, y);
    y += 10;
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Émis le ${new Date().toLocaleString("fr-FR")}`, 20, y);
    doc.setTextColor(0);
    y += 12;

    // Scoring
    doc.setFontSize(11);
    doc.text(`Scoring de sécurité : ${report.scoring_securite} %`, 20, y);
    y += 6;
    if (report.kit_recommande) {
      doc.text(`Kit recommandé : ${KIT_LABELS[report.kit_recommande] ?? report.kit_recommande}`, 20, y);
      y += 6;
    }
    if (report.charge_cible_kg != null) {
      doc.text(`Charge cible (coef ×4) : ${report.charge_cible_kg} kg`, 20, y);
      y += 6;
    }
    if (report.mur_type) { doc.text(`Mur identifié : ${report.mur_type}`, 20, y); y += 6; }
    if (report.media_type) { doc.text(`Média : ${report.media_type}`, 20, y); y += 6; }
    if (report.r_global != null) { doc.text(`Indice R_global : ${report.r_global.toFixed(2)}`, 20, y); y += 6; }
    y += 4;

    // Photo
    const firstPhoto = images[0]?.data_url;
    if (firstPhoto) {
      try {
        doc.addImage(firstPhoto, "JPEG", 20, y, 80, 60);
      } catch {}
    }

    // Alertes
    let ay = y;
    doc.setFontSize(10);
    doc.text("Alertes :", 110, ay);
    ay += 5;
    doc.setFontSize(9);
    const alerts = report.alertes.length ? report.alertes : ["Aucune alerte"];
    for (const a of alerts) {
      const lines = doc.splitTextToSize(`• ${a}`, 80);
      doc.text(lines, 110, ay);
      ay += lines.length * 4.5;
    }
    y = Math.max(y + 65, ay) + 6;

    // Rapport
    doc.setFontSize(10);
    doc.text("Rapport technique", 20, y);
    y += 5;
    doc.setFontSize(8);
    const reportLines = doc.splitTextToSize(report.rapport_md || "—", W - 40);
    for (const line of reportLines) {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, 20, y);
      y += 4;
    }

    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text("Document généré par KOA Vision — Cabinet d'ingénierie de l'accrochage. Coefficient de sécurité ×4 appliqué.", 20, 290);

    doc.save(`koa-vision-${mode}-${Date.now()}.pdf`);
  };

  return (
    <main className="max-w-md mx-auto px-5 pt-8 pb-12">
      <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
        <Eye className="size-3.5" /> KOA Vision
      </div>
      <h1 className="serif text-3xl mt-2">Diagnostic IA visuel</h1>
      <p className="text-sm text-muted-foreground mt-2">
        Photographiez l'œuvre et le mur (mode recommandation) ou un système installé (mode diagnostic).
        Le moteur applique la règle d'or KOA <strong>×4</strong> et propose le kit adapté.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-px bg-border border border-border">
        {(["recommendation", "diagnostic"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`p-3 text-[10px] uppercase tracking-widest ${mode === m ? "bg-foreground text-background" : "bg-card hover:bg-secondary"}`}
          >
            {m === "recommendation" ? "Recommandation" : "Diagnostic état"}
          </button>
        ))}
      </div>

      <section className="mt-6 space-y-3">
        <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Photos (max 3, 5 Mo / image)</Label>
        <label className="block border border-dashed border-border p-6 text-center cursor-pointer hover:bg-secondary">
          <Upload className="size-5 mx-auto text-muted-foreground" />
          <span className="text-xs mt-2 block">Ajouter des photos</span>
          <input type="file" multiple accept="image/*" className="hidden"
            onChange={(e) => { addFiles(e.target.files, mode === "recommendation" ? "œuvre/mur" : "système installé"); e.target.value = ""; }} />
        </label>
        {images.length > 0 && (
          <ul className="grid grid-cols-3 gap-2">
            {images.map((img, i) => (
              <li key={i} className="relative aspect-square bg-secondary overflow-hidden">
                <img src={img.data_url} alt={img.label} className="size-full object-cover" />
                <button onClick={() => setImages(images.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 bg-background/80 text-[10px] px-1.5 py-0.5">×</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 space-y-3">
        <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Œuvre liée (optionnel)</Label>
        <select value={artworkId} onChange={(e) => setArtworkId(e.target.value)}
          className="w-full border-0 border-b border-border bg-transparent h-9 text-sm focus:outline-none focus:border-foreground">
          <option value="">— Aucune (analyse libre) —</option>
          {artworks.map((a: any) => (
            <option key={a.id} value={a.id}>{a.title}{a.location ? ` · ${a.location}` : ""}</option>
          ))}
        </select>
      </section>

      <section className="mt-6 space-y-3">
        <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Contexte (optionnel mais recommandé)</Label>
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Poids kg" value={ctx.weight_kg} onChange={(e) => setCtx({ ...ctx, weight_kg: e.target.value })} />
          <Input placeholder="Haut. m" value={ctx.height_m} onChange={(e) => setCtx({ ...ctx, height_m: e.target.value })} />
          <Input placeholder="Âge ans" value={ctx.age_years} onChange={(e) => setCtx({ ...ctx, age_years: e.target.value })} />
        </div>
        <Input placeholder="Type de mur / emplacement (placo, béton, pierre…)" value={ctx.location} onChange={(e) => setCtx({ ...ctx, location: e.target.value })} />
        <Textarea placeholder="Notes (humidité, vibrations, accès…)" rows={2} value={ctx.notes} onChange={(e) => setCtx({ ...ctx, notes: e.target.value })} />
      </section>

      <Button onClick={submit} disabled={loading} className="mt-6 w-full">
        {loading ? <><Loader2 className="size-4 mr-2 animate-spin" /> {LOADER_MESSAGES[loaderStep]}</> : "Lancer l'analyse"}
      </Button>

      {report && (
        <section className="mt-8 border-t border-border pt-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground">Scoring de sécurité</p>
              <p className={`mt-1 text-4xl font-light border-b-2 inline-block ${scoreColor(report.scoring_securite)}`}>
                {report.scoring_securite}%
              </p>
            </div>
            <ShieldCheck className={`size-8 ${scoreColor(report.scoring_securite).split(" ")[0]}`} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            {report.mur_type && (
              <div className="border border-border p-3">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Mur</p>
                <p className="mt-1">{report.mur_type}</p>
              </div>
            )}
            {report.media_type && (
              <div className="border border-border p-3">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Média</p>
                <p className="mt-1">{report.media_type}</p>
              </div>
            )}
            {report.charge_cible_kg != null && (
              <div className="border border-border p-3">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Charge cible ×4</p>
                <p className="mt-1">{report.charge_cible_kg} kg</p>
              </div>
            )}
            {report.r_global != null && (
              <div className="border border-border p-3">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">R_global</p>
                <p className="mt-1">{report.r_global.toFixed(2)}</p>
              </div>
            )}
          </div>

          {report.kit_recommande && (
            <div className="border border-foreground p-4">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Kit KOA recommandé</p>
              <p className="mt-1 text-sm font-medium">{KIT_LABELS[report.kit_recommande] ?? report.kit_recommande}</p>
              {report.kit_justification && (
                <p className="mt-2 text-xs text-muted-foreground">{report.kit_justification}</p>
              )}
            </div>
          )}

          {report.alertes.length > 0 && (
            <div className="border border-border p-4 space-y-2">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="size-3.5" /> Alertes
              </p>
              <ul className="text-xs space-y-1">
                {report.alertes.map((a, i) => <li key={i}>• {a}</li>)}
              </ul>
            </div>
          )}

          <details className="border border-border p-4">
            <summary className="text-[9px] uppercase tracking-widest text-muted-foreground cursor-pointer">Rapport détaillé</summary>
            <pre className="mt-3 whitespace-pre-wrap text-xs leading-relaxed font-sans">{report.rapport_md}</pre>
          </details>

          <Button onClick={exportCertificate} variant="outline" className="w-full">
            <FileDown className="size-4 mr-2" /> Certificat État Zéro (PDF)
          </Button>

          <div className="border border-border p-4">
            <p className="text-[10px] tracking-widest uppercase text-muted-foreground flex items-center gap-2">
              <Link2 className="size-3.5" /> Rattacher à une œuvre
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Le rapport sera ajouté au journal de maintenance et les photos archivées en pièces jointes.
            </p>
            <Button onClick={attachToArtwork} disabled={!artworkId || saving} className="mt-3 w-full" variant="outline">
              {saving ? <><Loader2 className="size-4 mr-2 animate-spin" /> Enregistrement…</> : "Enregistrer dans la fiche"}
            </Button>
            {!artworkId && (
              <p className="text-[10px] text-muted-foreground mt-2">Sélectionnez d'abord une œuvre dans la liste ci-dessus.</p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
