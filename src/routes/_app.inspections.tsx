import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronLeft, ClipboardCheck, Download, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listAllInspections, createInspection } from "@/lib/inspections.functions";
import { formatDate, formatDateTime } from "@/lib/koa-helpers";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

type InspectionRow = {
  id: string;
  performed_at: string;
  next_due_at: string | null;
  period_type: string;
  notes: string | null;
  score_global: number | null;
  artwork_id: string;
  artworks: { title: string | null; owner_id: string | null; location: string | null } | null;
};

type PlanningRow = {
  artwork_id: string;
  title: string;
  location: string | null;
  site: string | null;
  room: string | null;
  criticality: string | null;
  last_inspection_at: string | null;
  next_due_at: string | null;
  last_score: number | null;
  last_period_type: string | null;
  inspection_status: "jamais_inspecte" | "en_retard" | "echeance_proche" | "a_jour";
};

const STATUS_META: Record<PlanningRow["inspection_status"], { label: string; color: string }> = {
  jamais_inspecte: { label: "Jamais inspecté", color: "border-muted-foreground text-muted-foreground" },
  en_retard: { label: "En retard", color: "border-destructive text-destructive" },
  echeance_proche: { label: "Sous 7 jours", color: "border-vigilance text-vigilance" },
  a_jour: { label: "À jour", color: "border-ok text-ok" },
};

function toCsv(rows: InspectionRow[]) {
  const header = ["Date", "Œuvre", "Emplacement", "Fréquence", "Score", "Prochaine échéance", "Notes"];
  const escape = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) => [
    r.performed_at,
    r.artworks?.title ?? "",
    r.artworks?.location ?? "",
    r.period_type,
    r.score_global != null ? Number(r.score_global).toFixed(2) : "",
    r.next_due_at ?? "",
    (r.notes ?? "").replace(/\n/g, " "),
  ].map(escape).join(";"));
  return "\uFEFF" + [header.join(";"), ...lines].join("\n");
}

function InspectionsPage() {
  const list = useServerFn(listAllInspections);
  const { data: rows = [] } = useQuery<InspectionRow[]>({ queryKey: ["inspections-all"], queryFn: () => list() as unknown as Promise<InspectionRow[]> });

  const { data: planning = [] } = useQuery<PlanningRow[]>({
    queryKey: ["inspection-planning"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artwork_inspection_status" as never)
        .select("*")
        .order("next_due_at", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return (data ?? []) as PlanningRow[];
    },
  });

  const exportCsv = () => {
    if (!rows.length) return toast.info("Rien à exporter");
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inspections-koa-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé");
  };

  const groupedPlanning = {
    en_retard: planning.filter((p) => p.inspection_status === "en_retard"),
    echeance_proche: planning.filter((p) => p.inspection_status === "echeance_proche"),
    jamais_inspecte: planning.filter((p) => p.inspection_status === "jamais_inspecte"),
    a_jour: planning.filter((p) => p.inspection_status === "a_jour"),
  };

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

      <Tabs defaultValue="journal" className="mt-6">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="planning">
            Planning
            {groupedPlanning.en_retard.length + groupedPlanning.echeance_proche.length > 0 && (
              <span className="ml-2 text-[10px] mono bg-destructive text-destructive-foreground px-1.5 rounded">
                {groupedPlanning.en_retard.length + groupedPlanning.echeance_proche.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="journal" className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{rows.length} inspection(s)</p>
            <Button onClick={exportCsv} variant="outline" size="sm" className="rounded-sm text-[10px] tracking-widest uppercase h-8">
              <Download className="size-3 mr-1" /> Export CSV
            </Button>
          </div>
          <ul className="space-y-4">
            {rows.length === 0 && (
              <li className="text-sm text-muted-foreground">Aucune inspection enregistrée.</li>
            )}
            {rows.map((r) => (
              <li key={r.id} className="border-l-2 border-border pl-4">
                <p className="text-[10px] mono uppercase tracking-widest text-muted-foreground">
                  {formatDateTime(r.performed_at)} · {r.period_type}
                  {r.next_due_at && <> · prochaine {formatDate(r.next_due_at)}</>}
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
        </TabsContent>

        <TabsContent value="planning" className="mt-4 space-y-6">
          <PlanningBlock title="En retard" rows={groupedPlanning.en_retard} status="en_retard" />
          <PlanningBlock title="Échéance sous 7 jours" rows={groupedPlanning.echeance_proche} status="echeance_proche" />
          <PlanningBlock title="Jamais inspecté" rows={groupedPlanning.jamais_inspecte} status="jamais_inspecte" />
          <PlanningBlock title="À jour" rows={groupedPlanning.a_jour} status="a_jour" collapsed />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function PlanningBlock({ title, rows, status, collapsed }: { title: string; rows: PlanningRow[]; status: PlanningRow["inspection_status"]; collapsed?: boolean }) {
  const [open, setOpen] = useState(!collapsed);
  const meta = STATUS_META[status];
  return (
    <section>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between border-b border-border py-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-3.5 text-muted-foreground" />
          <span className="text-xs tracking-widest uppercase">{title}</span>
          <span className={`text-[10px] mono border px-1.5 py-0.5 ${meta.color}`}>{rows.length}</span>
        </div>
        <span className="text-muted-foreground">{open ? "−" : "+"}</span>
      </button>
      {open && (
        rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">Aucune œuvre.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.artwork_id}>
                <Link to="/artworks/$id" params={{ id: r.artwork_id }} className="flex items-center justify-between py-3 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{r.title}</p>
                    <p className="text-[10px] mono text-muted-foreground truncate">
                      {[r.site, r.room, r.location].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-[10px] mono ${status === "en_retard" ? "text-destructive" : "text-muted-foreground"}`}>
                      {r.next_due_at ? formatDate(r.next_due_at) : "—"}
                    </p>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{r.last_period_type ?? ""}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
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
      qc.invalidateQueries({ queryKey: ["inspection-planning"] });
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
