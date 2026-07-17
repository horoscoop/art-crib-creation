/**
 * KOA Guardian — Phase 3 : dialogue de saisie de maintenance par lot.
 *
 * Repris à l'identique du style de NewInspectionDialog existant
 * (src/routes/_app.inspections.tsx) pour ne pas introduire un second
 * vocabulaire visuel, + 3 champs de mesure quantitative en complément
 * des signatures (validé : les deux coexistent).
 *
 * Se déclenche depuis ArtworkRegistryList.tsx (mode "Lot") avec les
 * artwork_id sélectionnés.
 *
 * À placer dans src/components/koa/batch-maintenance-dialog.tsx
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createInspectionsBatch } from "@/lib/inspections.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const SIG_LEVELS = ["ok", "mineur", "modere", "majeur", "critique"] as const;
const SIG_AXES = [
  { key: "fatigue", label: "Fatigue mécanique" },
  { key: "corrosion", label: "Corrosion" },
  { key: "support", label: "Support mural" },
  { key: "fluage", label: "Fluage / relaxation" },
  { key: "sismique", label: "Risque sismique" },
] as const;

interface BatchMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artworkIds: string[];
  artworkTitles: string[]; // pour l'affichage du récapitulatif
  onDone: () => void; // réinitialise la sélection dans ArtworkRegistryList
}

export function BatchMaintenanceDialog({
  open,
  onOpenChange,
  artworkIds,
  artworkTitles,
  onDone,
}: BatchMaintenanceDialogProps) {
  const qc = useQueryClient();
  const createBatch = useServerFn(createInspectionsBatch);
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "annual" | "ad_hoc">("ad_hoc");
  const [notes, setNotes] = useState("");
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [tensionN, setTensionN] = useState("");
  const [glissementMm, setGlissementMm] = useState("");
  const [hauteurLaserCm, setHauteurLaserCm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const measures = {
        ...(tensionN && { tension_n: Number(tensionN) }),
        ...(glissementMm && { glissement_mm: Number(glissementMm) }),
        ...(hauteurLaserCm && { hauteur_laser_cm: Number(hauteurLaserCm) }),
      };
      await createBatch({
        data: {
          artwork_ids: artworkIds,
          period_type: period,
          notes,
          signatures: signatures as any,
          measures,
        },
      });
      toast.success(`${artworkIds.length} inspection(s) enregistrée(s)`);
      qc.invalidateQueries({ queryKey: ["artwork-registry"] });
      qc.invalidateQueries({ queryKey: ["inspections-all"] });
      qc.invalidateQueries({ queryKey: ["inspection-planning"] });
      setNotes(""); setSignatures({}); setTensionN(""); setGlissementMm(""); setHauteurLaserCm("");
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="serif text-2xl font-normal">Audit par lot</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-secondary border border-border">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              {artworkIds.length} œuvre{artworkIds.length > 1 ? "s" : ""} sélectionnée{artworkIds.length > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground truncate">{artworkTitles.join(" · ")}</p>
          </div>

          <div>
            <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Fréquence</Label>
            <select value={period} onChange={(e) => setPeriod(e.target.value as any)}
              className="w-full mt-1 border-0 border-b border-border bg-transparent h-9 text-sm focus:outline-none">
              <option value="ad_hoc">Ponctuelle</option>
              <option value="monthly">Mensuelle</option>
              <option value="quarterly">Trimestrielle</option>
              <option value="annual">Annuelle</option>
            </select>
          </div>

          <div>
            <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Signatures visuelles observées</Label>
            <div className="mt-2 space-y-2">
              {SIG_AXES.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span className="text-xs">{label}</span>
                  <select value={signatures[key] ?? ""} onChange={(e) => setSignatures({ ...signatures, [key]: e.target.value })}
                    className="text-xs border-0 border-b border-border bg-transparent h-8 focus:outline-none">
                    <option value="">—</option>
                    {SIG_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Mesures quantitatives — en complément des signatures, pas en remplacement */}
          <div>
            <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Mesures relevées (optionnel)</Label>
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs">Tension mesurée</span>
                <div className="flex items-center gap-1">
                  <input type="number" min={0} value={tensionN} onChange={(e) => setTensionN(e.target.value)}
                    className="w-20 text-xs text-right border-0 border-b border-border bg-transparent h-8 focus:outline-none" />
                  <span className="text-[10px] text-muted-foreground">N</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs">Glissement de câble</span>
                <div className="flex items-center gap-1">
                  <input type="number" min={0} value={glissementMm} onChange={(e) => setGlissementMm(e.target.value)}
                    className="w-20 text-xs text-right border-0 border-b border-border bg-transparent h-8 focus:outline-none" />
                  <span className="text-[10px] text-muted-foreground">mm</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs">Hauteur laser de contrôle</span>
                <div className="flex items-center gap-1">
                  <input type="number" min={0} value={hauteurLaserCm} onChange={(e) => setHauteurLaserCm(e.target.value)}
                    className="w-20 text-xs text-right border-0 border-b border-border bg-transparent h-8 focus:outline-none" />
                  <span className="text-[10px] text-muted-foreground">cm</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Notes terrain</Label>
            <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
              className="mt-1 rounded-sm border-0 border-b border-border bg-transparent px-0" />
          </div>

          <p className="text-[10px] text-muted-foreground italic">
            Le dépôt de justificatifs par pièce reste à faire individuellement sur chaque
            fiche œuvre après l'audit groupé (système déjà en place, non dupliqué ici).
          </p>

          <Button onClick={submit} disabled={submitting} className="w-full rounded-sm h-10 text-xs tracking-widest uppercase">
            {submitting ? "Enregistrement…" : `Enregistrer pour ${artworkIds.length} œuvre${artworkIds.length > 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
