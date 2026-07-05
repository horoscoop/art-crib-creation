import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronLeft, FileText, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { useRoles } from "@/lib/use-roles";
import { useAuth } from "@/lib/auth-context";
import { getComplianceData } from "@/lib/compliance-report.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import jsPDF from "jspdf";

export const Route = createFileRoute("/_app/compliance")({
  head: () => ({ meta: [{ title: "Rapport de conformité — KOA Guardian" }] }),
  component: CompliancePage,
});

function CompliancePage() {
  const { isAdmin } = useRoles();
  const { user } = useAuth();
  const navigate = useNavigate();
  const load = useServerFn(getComplianceData);
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    institution: "",
    responsable: user?.email ?? "",
    reference: `KOA-${new Date().getFullYear()}-01`,
    start_date: yearStart,
    end_date: today,
  });
  const [busy, setBusy] = useState(false);

  if (!isAdmin) {
    return (
      <main className="max-w-md mx-auto px-5 pt-12 text-center">
        <p className="text-xs tracking-widest uppercase text-muted-foreground">Accès restreint</p>
        <h1 className="serif text-2xl mt-2">Rapport de conformité</h1>
        <p className="text-sm text-muted-foreground mt-4">Réservé aux administrateurs.</p>
        <button onClick={() => navigate({ to: "/" })} className="mt-6 text-xs tracking-widest uppercase underline">Retour</button>
      </main>
    );
  }

  const generate = async () => {
    if (!form.institution.trim() || !form.responsable.trim()) return toast.error("Institution et responsable requis");
    setBusy(true);
    try {
      const startIso = new Date(form.start_date + "T00:00:00Z").toISOString();
      const endIso = new Date(form.end_date + "T23:59:59Z").toISOString();
      const d = await load({ data: { start_date: startIso, end_date: endIso } });

      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const W = 210, H = 297, M = 20;
      const totalPagesPlaceholder = "{TOTAL}";
      let pageNum = 0;

      const footer = () => {
        pageNum++;
        doc.setFontSize(7); doc.setTextColor(120);
        doc.text(`KOA Guardian | ${form.institution} | Rapport ${form.reference} | Page ${pageNum}/${totalPagesPlaceholder} | Confidentiel`, W / 2, H - 8, { align: "center" });
        doc.setTextColor(0);
      };
      const newPage = (title?: string) => {
        doc.addPage(); footer();
        if (title) { doc.setFontSize(14); doc.text(title, M, 25); doc.setLineWidth(0.2); doc.line(M, 28, W - M, 28); return 38; }
        return 25;
      };

      // Cover
      footer();
      doc.setFontSize(24); doc.text("KOA", W / 2, 60, { align: "center" });
      doc.setFontSize(9); doc.setTextColor(120); doc.text("KINGDOM OF ARTS", W / 2, 66, { align: "center" }); doc.setTextColor(0);
      doc.setFontSize(16); doc.text("RAPPORT DE CONSERVATION", W / 2, 95, { align: "center" });
      doc.text("ET DE CONFORMITÉ", W / 2, 103, { align: "center" });
      doc.setFontSize(11); doc.text("Système KOA Guardian", W / 2, 115, { align: "center" });
      let y = 145;
      const line = (k: string, v: string) => { doc.setFontSize(9); doc.setTextColor(120); doc.text(k, M + 10, y); doc.setTextColor(0); doc.text(v, M + 60, y); y += 8; };
      line("Institution", form.institution);
      line("Responsable", form.responsable);
      line("Période", `du ${form.start_date} au ${form.end_date}`);
      line("Référence", form.reference);
      line("Généré le", new Date().toLocaleDateString("fr-FR"));

      // Section 1 — Synthèse
      let ny = newPage("1. Synthèse exécutive");
      const s = d.summary;
      const bar = (label: string, value: string) => {
        doc.setFontSize(10); doc.text(label, M, ny); doc.text(value, W - M, ny, { align: "right" }); ny += 7;
      };
      bar("Œuvres surveillées", String(s.totalArtworks));
      bar("Score moyen de santé", `${s.healthScore} / 100`);
      bar("Alertes critiques (période)", `${s.criticalAlerts} (${s.criticalResolved} résolues)`);
      bar("Couverture d'inspections", `${s.inspectionCoverage} %`);
      bar("Expertises réalisées", String(s.expertisesCount));
      bar("Œuvres à attention immédiate", String(s.needsAttention));

      // Section 2 — Inventaire
      ny = newPage("2. Inventaire des œuvres");
      doc.setFontSize(8);
      for (const a of d.artworks as any[]) {
        if (ny > H - 20) ny = newPage("2. Inventaire (suite)");
        const loc = [a.site, a.room, a.location].filter(Boolean).join(" · ") || "—";
        doc.text(`• ${a.title ?? "—"} — ${a.artist ?? ""}`, M, ny); ny += 4;
        doc.setTextColor(120);
        doc.text(`   ${loc} · ${a.weight_kg ?? "—"} kg · ${a.koa_system ?? "—"} · NFC ${a.nfc_id ?? "—"} · ${a.criticality ?? "—"}`, M, ny);
        doc.setTextColor(0); ny += 6;
      }

      // Section 3 — Inspections
      ny = newPage("3. Historique des inspections");
      doc.setFontSize(8);
      if (!d.inspections.length) { doc.text("Aucune inspection sur la période.", M, ny); }
      for (const i of d.inspections as any[]) {
        if (ny > H - 20) ny = newPage("3. Inspections (suite)");
        doc.text(`• ${new Date(i.performed_at).toLocaleDateString("fr-FR")} — ${i.artworks?.title ?? "—"} — ${i.period_type} — score ${i.score_global != null ? Number(i.score_global).toFixed(2) : "—"}`, M, ny);
        ny += 5;
      }

      // Section 4 — Alertes
      ny = newPage("4. Alertes et incidents");
      doc.setFontSize(8);
      if (!d.alerts.length) doc.text("Aucune alerte sur la période.", M, ny);
      for (const a of d.alerts as any[]) {
        if (ny > H - 20) ny = newPage("4. Alertes (suite)");
        doc.text(`• ${new Date(a.created_at).toLocaleDateString("fr-FR")} — ${a.artworks?.title ?? "—"} — ${a.kind}/${a.severity} — ${a.resolved ? "résolu" : "actif"}`, M, ny);
        ny += 4;
        doc.setTextColor(120);
        const msg = doc.splitTextToSize(`   ${a.message}`, W - 2 * M);
        doc.text(msg, M, ny); ny += msg.length * 4;
        doc.setTextColor(0);
      }

      // Section 5 — Expertises
      ny = newPage("5. Expertises réalisées");
      doc.setFontSize(8);
      if (!d.expertises.length) doc.text("Aucune expertise sur la période.", M, ny);
      for (const e of d.expertises as any[]) {
        if (ny > H - 20) ny = newPage("5. Expertises (suite)");
        doc.text(`• ${new Date(e.performed_at).toLocaleDateString("fr-FR")} — ${e.artworks?.title ?? "—"} — ${e.type} — ${e.expert_name ?? ""} — kit ${e.kit_recommande ?? "—"} — ${e.charge_mesuree_kg ?? "—"} kg`, M, ny);
        ny += 5;
      }

      // Section 6 — Recommandations
      ny = newPage("6. Recommandations générées");
      doc.setFontSize(9);
      if (!d.recommendations.length) doc.text("Aucune recommandation particulière.", M, ny);
      for (const r of d.recommendations) {
        if (ny > H - 20) ny = newPage("6. Recommandations (suite)");
        doc.text(`• ${r.title}`, M, ny); ny += 4;
        doc.setTextColor(120);
        const t = doc.splitTextToSize(`   ${r.text}`, W - 2 * M);
        doc.text(t, M, ny); ny += t.length * 4 + 2;
        doc.setTextColor(0);
      }

      // Attestation
      ny = newPage("Attestation de conformité");
      doc.setFontSize(10);
      const att = doc.splitTextToSize(
        `Je soussigné(e), ${form.responsable}, en qualité de responsable de la conservation de ${form.institution}, atteste que les informations contenues dans ce rapport sont issues du système de surveillance KOA Guardian et reflètent fidèlement l'état du parc d'œuvres à la date de génération.`,
        W - 2 * M,
      );
      doc.text(att, M, ny); ny += att.length * 5 + 20;
      doc.text("Fait à ______________________, le ______________________", M, ny); ny += 20;
      doc.text("Signature :", M, ny);
      doc.setLineWidth(0.2); doc.line(M + 30, ny + 2, W - M, ny + 2);

      // Replace total page marker on all pages
      const total = doc.getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        // Simply re-paint the footer with correct total (overwrite by drawing a white rectangle then footer).
        doc.setFillColor(255, 255, 255);
        doc.rect(0, H - 12, W, 10, "F");
        doc.setFontSize(7); doc.setTextColor(120);
        doc.text(`KOA Guardian | ${form.institution} | Rapport ${form.reference} | Page ${p}/${total} | Confidentiel`, W / 2, H - 8, { align: "center" });
        doc.setTextColor(0);
      }

      const slug = form.institution.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "institution";
      const now = new Date();
      doc.save(`rapport-conformite-koa-${slug}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.pdf`);
      toast.success("Rapport généré avec succès");
    } catch (e: any) {
      toast.error(e.message || "Échec de la génération");
    } finally { setBusy(false); }
  };

  return (
    <main className="max-w-md mx-auto px-5 pt-8 pb-12">
      <Link to="/" className="inline-flex items-center gap-1 text-xs tracking-widest uppercase text-muted-foreground">
        <ChevronLeft className="size-4" /> Parc
      </Link>
      <header className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground">Conformité</p>
          <h1 className="serif text-3xl mt-1">Rapport annuel</h1>
        </div>
        <FileText className="size-5 text-muted-foreground" />
      </header>

      <p className="mt-4 text-sm text-muted-foreground">
        Compile inventaire, inspections, alertes, expertises et recommandations sur la période choisie
        en un PDF signable.
      </p>

      <section className="mt-8 space-y-5">
        <div>
          <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Institution</Label>
          <Input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })}
            placeholder="Musée d'Art Contemporain"
            className="mt-1 rounded-sm border-0 border-b border-border bg-transparent px-0 h-10" />
        </div>
        <div>
          <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Responsable</Label>
          <Input value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })}
            placeholder={user?.email ?? "Nom du responsable"}
            className="mt-1 rounded-sm border-0 border-b border-border bg-transparent px-0 h-10" />
        </div>
        <div>
          <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Référence</Label>
          <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })}
            className="mt-1 rounded-sm border-0 border-b border-border bg-transparent px-0 h-10 mono text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Du</Label>
            <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              className="mt-1 rounded-sm border-0 border-b border-border bg-transparent px-0 h-10" />
          </div>
          <div>
            <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Au</Label>
            <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className="mt-1 rounded-sm border-0 border-b border-border bg-transparent px-0 h-10" />
          </div>
        </div>

        <Button onClick={generate} disabled={busy} className="w-full rounded-sm h-11 text-xs tracking-widest uppercase">
          {busy ? <><Loader2 className="size-4 mr-2 animate-spin" /> Génération…</> : <><Download className="size-4 mr-2" /> Générer le PDF</>}
        </Button>
      </section>
    </main>
  );
}
