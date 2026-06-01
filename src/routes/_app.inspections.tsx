import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronLeft, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listAllInspections, createInspection } from "@/lib/inspections.functions";
import { formatDateTime } from "@/lib/koa-helpers";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/inspections")({
  head: () => ({ meta: [{ title: "Suivi périodique — KOA Guardian" }] }),
  component: InspectionsPage,
});

const SIG_LEVELS = ["ok", "mineur", "modere", "majeur", "critique"] as const;
const SIG_AXES = [
  { key: "fatigue", label: "Fatigue mécanique" },
  { key: "corrosion", label: "Corrosion" },
  { key: "support", label: "Support mural" },
  { key: "fluage", label: "Fluage / relaxation" },
  { key: "sismique", label: "Risque sismique" },
] as const;

function InspectionsPage() {
  const list = useServerFn(listAllInspections);
  const { data: rows = [] } = useQuery({ queryKey: ["inspections-all"], queryFn: () => list() });

  return (
    <main className="max-w-md mx-auto px-5 pt-8 pb-12">
      <Link to="/" className="inline-flex items-center gap-1 text-xs tracking-widest uppercase text-muted-foreground">
        <ChevronLeft className="size-4" /> Parc
      </Link>
      <header className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground">Conservation</p>
          <h1 className="serif text-3xl mt-1">Suivi périodique</h1>
        </div>
        <ClipboardCheck className="size-5 text-muted-foreground" />
      </header>

      <ul className="mt-8 space-y-4">
        {rows.length === 0 && (
          <li className="text-sm text-muted-foreground">Aucune inspection enregistrée. Ouvrez une fiche œuvre pour en saisir une.</li>
        )}
        {rows.map((r: any) => (
          <li key={r.id} className="border-l-2 border-border pl-4">
            <p className="text-[10px] mono uppercase tracking-widest text-muted-foreground">
              {formatDateTime(r.performed_at)} · {r.period_type}
              {r.next_due_at && <> · prochaine {formatDateTime(r.next_due_at)}</>}
            </p>
            <Link to="/artworks/$id" params={{ id: r.artwork_id }} className="serif text-lg block mt-1 underline-offset-4 hover:underline">
              {r.artworks?.title ?? "—"}
            </Link>
            {r.notes && <p className="text-sm mt-1 text-muted-foreground">{r.notes}</p>}
            <p className="text-[10px] uppercase tracking-widest mt-2">
              Score global : <span className="mono">{r.score_global != null ? Number(r.score_global).toFixed(2) : "—"}</span>
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}

export function NewInspectionDialog({ artworkId }: { artworkId: string }) {
  const qc = useQueryClient();
  const create = useServerFn(createInspection);
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "annual" | "ad_hoc">("ad_hoc");
  const [notes, setNotes] = useState("");
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<FileList | null>(null);

  const submit = async () => {
    try {
      const row: any = await create({ data: { artwork_id: artworkId, period_type: period, notes, signatures: signatures as any } });
      if (files && files.length) {
        for (const f of Array.from(files)) {
          const path = `${artworkId}/inspections/${row.id}/${Date.now()}-${f.name}`;
          const { error } = await supabase.storage.from("artwork-attachments").upload(path, f);
          if (!error) {
            await supabase.from("attachments").insert({
              artwork_id: artworkId, storage_path: path, filename: f.name,
              mime_type: f.type, size_bytes: f.size,
            });
          }
        }
      }
      toast.success("Inspection enregistrée");
      qc.invalidateQueries({ queryKey: ["inspections", artworkId] });
      qc.invalidateQueries({ queryKey: ["inspections-all"] });
      qc.invalidateQueries({ queryKey: ["attachments", artworkId] });
      setOpen(false);
      setNotes(""); setSignatures({}); setFiles(null); setPeriod("ad_hoc");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="text-xs tracking-widest uppercase text-accent">+ Inspection</DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="serif text-2xl font-normal">Inspection périodique</DialogTitle></DialogHeader>
        <div className="space-y-4">
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
          <div>
            <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Notes terrain</Label>
            <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
              className="mt-1 rounded-sm border-0 border-b border-border bg-transparent px-0" />
          </div>
          <div>
            <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Pièces jointes</Label>
            <input type="file" multiple onChange={(e) => setFiles(e.target.files)}
              className="mt-1 block w-full text-xs file:mr-3 file:py-1 file:px-3 file:border file:border-border file:bg-transparent file:text-xs file:uppercase file:tracking-widest" />
          </div>
          <Button onClick={submit} className="w-full rounded-sm h-10 text-xs tracking-widest uppercase">Enregistrer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
