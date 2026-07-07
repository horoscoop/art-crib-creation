import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronLeft, Radar, BarChart3, Lightbulb, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRoles } from "@/lib/use-roles";
import {
  listHighlights, createHighlight, updateHighlightStatus, runWatchAnalysis,
  listCompetitors, upsertCompetitor,
  listSuggestions, createSuggestion, updateSuggestionStatus,
} from "@/lib/expert-lab.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/expert-lab")({
  head: () => ({ meta: [{ title: "Expert Lab — KOA Guardian" }] }),
  component: ExpertLabPage,
});

const CATEGORY_LABEL: Record<string, string> = {
  technique: "Technique", marche: "Marché", reglementaire: "Réglementaire", interne: "Signal interne",
};
const CATEGORY_COLOR: Record<string, string> = {
  technique: "bg-blue-950/10 text-blue-800 border-blue-200",
  marche: "bg-amber-950/10 text-amber-800 border-amber-200",
  reglementaire: "bg-emerald-950/10 text-emerald-800 border-emerald-200",
  interne: "bg-red-950/10 text-red-800 border-red-200",
};
const IMPACT_COLOR: Record<string, string> = {
  faible: "bg-muted text-muted-foreground",
  moyen: "bg-amber-100 text-amber-800",
  fort: "bg-red-100 text-red-800",
};

function ExpertLabPage() {
  const { isAdminOrExpert } = useRoles();
  if (!isAdminOrExpert) return <Navigate to="/" />;

  return (
    <main className="max-w-md mx-auto px-5 pt-8 pb-24">
      <Link to="/" className="inline-flex items-center gap-1 text-xs tracking-widest uppercase text-muted-foreground">
        <ChevronLeft className="size-4" /> Parc
      </Link>
      <header className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground">Espace Expert KOA</p>
          <h1 className="serif text-3xl mt-1">Expert Lab</h1>
          <p className="text-xs text-muted-foreground mt-1">Veille, benchmark et suggestions catalogue</p>
        </div>
      </header>

      <Tabs defaultValue="highlights" className="mt-8">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="highlights" className="gap-1.5"><Radar className="size-3.5" /> Veille</TabsTrigger>
          <TabsTrigger value="benchmark" className="gap-1.5"><BarChart3 className="size-3.5" /> Benchmark</TabsTrigger>
          <TabsTrigger value="suggestions" className="gap-1.5"><Lightbulb className="size-3.5" /> Suggestions</TabsTrigger>
        </TabsList>

        <TabsContent value="highlights"><HighlightsTab /></TabsContent>
        <TabsContent value="benchmark"><BenchmarkTab /></TabsContent>
        <TabsContent value="suggestions"><SuggestionsTab /></TabsContent>
      </Tabs>
    </main>
  );
}

// ============================================================================
// Onglet 1 — Fil de veille (faits marquants)
// ============================================================================
function HighlightsTab() {
  const qc = useQueryClient();
  const list = useServerFn(listHighlights);
  const create = useServerFn(createHighlight);
  const setStatus = useServerFn(updateHighlightStatus);
  const runAnalysis = useServerFn(runWatchAnalysis);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["highlights"], queryFn: () => list({ data: {} }) });

  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [form, setForm] = useState({ category: "marche", impact: "moyen", title: "", summary: "", source_label: "" });

  const relaunch = async () => {
    setRunning(true);
    try {
      const r = await runAnalysis();
      toast.success(`${r.inserted} nouveau${r.inserted > 1 ? "x" : ""} fait${r.inserted > 1 ? "s" : ""} marquant${r.inserted > 1 ? "s" : ""} généré${r.inserted > 1 ? "s" : ""}`);
      qc.invalidateQueries({ queryKey: ["highlights"] });
    } catch (e: any) { toast.error(e.message ?? "Analyse impossible"); }
    finally { setRunning(false); }
  };

  const submit = async () => {
    if (!form.title.trim() || !form.summary.trim()) return toast.error("Titre et résumé requis");
    try {
      await create({ data: form as any });
      toast.success("Fait marquant ajouté");
      qc.invalidateQueries({ queryKey: ["highlights"] });
      setOpen(false);
      setForm({ category: "marche", impact: "moyen", title: "", summary: "", source_label: "" });
    } catch (e: any) { toast.error(e.message); }
  };

  const archive = async (id: string) => {
    try {
      await setStatus({ data: { id, status: "archive" } });
      qc.invalidateQueries({ queryKey: ["highlights"] });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="mt-5 space-y-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full gap-1.5"><Plus className="size-3.5" /> Nouveau fait marquant</Button>
        </DialogTrigger>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="serif text-2xl font-normal">Fait marquant</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Catégorie</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Impact</Label>
              <Select value={form.impact} onValueChange={(v) => setForm((f) => ({ ...f, impact: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="faible">Faible</SelectItem>
                  <SelectItem value="moyen">Moyen</SelectItem>
                  <SelectItem value="fort">Fort</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Titre</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Résumé</Label>
              <Textarea rows={4} value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} />
            </div>
            <div>
              <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Source</Label>
              <Input placeholder="ex : editag.com — veille externe" value={form.source_label} onChange={(e) => setForm((f) => ({ ...f, source_label: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={submit}>Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {!isLoading && rows.length === 0 && <p className="text-sm text-muted-foreground">Aucun fait marquant enregistré.</p>}

      <ul className="space-y-3">
        {rows.filter((r: any) => r.status !== "archive").map((r: any) => (
          <li key={r.id} className="border border-border rounded-lg p-4">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className={cn("text-[10px]", CATEGORY_COLOR[r.category])}>{CATEGORY_LABEL[r.category]}</Badge>
                <Badge variant="outline" className={cn("text-[10px] border-transparent", IMPACT_COLOR[r.impact])}>Impact {r.impact}</Badge>
              </div>
              <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-FR")}</span>
            </div>
            <p className="text-sm font-medium leading-snug">{r.title}</p>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{r.summary}</p>
            <div className="flex items-center justify-between mt-3">
              <span className="text-[10px] text-muted-foreground">{r.source_label ?? "—"}</span>
              <button onClick={() => archive(r.id)} className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">
                Archiver
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// Onglet 2 — Benchmark concurrentiel
// ============================================================================
function LevelDot({ level }: { level: string }) {
  const color = level === "oui" ? "bg-emerald-600" : level === "partiel" ? "bg-amber-500" : "bg-red-500/70";
  return <span className={cn("inline-block size-2.5 rounded-full", color)} title={level} />;
}

function BenchmarkTab() {
  const list = useServerFn(listCompetitors);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["market-competitors"], queryFn: () => list() });

  const criteria = [
    { key: "antivol_renforce", label: "Antivol renforcé" },
    { key: "eclairage_integre", label: "Éclairage intégré" },
    { key: "charge_lourde", label: "Charge lourde" },
    { key: "instruments_mesure", label: "Instruments de mesure" },
    { key: "configurateur_digital", label: "Configurateur digital" },
  ];

  return (
    <div className="mt-5 space-y-3">
      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {rows.map((r: any) => (
        <div key={r.id} className={cn("border rounded-lg p-4", r.is_koa ? "border-accent bg-accent/5" : "border-border")}>
          <p className={cn("text-sm font-medium", r.is_koa && "text-accent")}>{r.competitor_name}</p>
          <p className="text-[11px] text-muted-foreground mb-2.5">{r.segment}</p>
          <div className="grid grid-cols-1 gap-1.5">
            {criteria.map((c) => (
              <div key={c.key} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{c.label}</span>
                <LevelDot level={r[c.key]} />
              </div>
            ))}
          </div>
          {r.notes && <p className="text-[11px] text-muted-foreground mt-2.5 leading-relaxed border-t border-border pt-2.5">{r.notes}</p>}
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground text-center pt-2">
        ● vert = couvert · ● ambre = partiel · ● rouge = non couvert
      </p>
    </div>
  );
}

// ============================================================================
// Onglet 3 — Suggestions (kanban simplifié)
// ============================================================================
const SUGGESTION_COLUMNS = [
  { key: "propose", label: "Proposé" },
  { key: "a_l_etude", label: "À l'étude" },
  { key: "adopte", label: "Adopté" },
  { key: "rejete", label: "Rejeté" },
] as const;

function SuggestionsTab() {
  const qc = useQueryClient();
  const list = useServerFn(listSuggestions);
  const create = useServerFn(createSuggestion);
  const setStatus = useServerFn(updateSuggestionStatus);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["catalog-suggestions"], queryFn: () => list() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", rationale: "", target: "catalogue_logiciel", priority: "moyenne" });

  const submit = async () => {
    if (!form.title.trim() || !form.rationale.trim()) return toast.error("Titre et justification requis");
    try {
      await create({ data: form as any });
      toast.success("Suggestion ajoutée");
      qc.invalidateQueries({ queryKey: ["catalog-suggestions"] });
      setOpen(false);
      setForm({ title: "", rationale: "", target: "catalogue_logiciel", priority: "moyenne" });
    } catch (e: any) { toast.error(e.message); }
  };

  const move = async (id: string, status: string) => {
    try {
      await setStatus({ data: { id, status: status as any } });
      qc.invalidateQueries({ queryKey: ["catalog-suggestions"] });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="mt-5 space-y-5">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full gap-1.5"><Plus className="size-3.5" /> Nouvelle suggestion</Button>
        </DialogTrigger>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="serif text-2xl font-normal">Suggestion</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Cible</Label>
              <Select value={form.target} onValueChange={(v) => setForm((f) => ({ ...f, target: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="produit_physique">Conception produit physique</SelectItem>
                  <SelectItem value="catalogue_logiciel">Catalogue logiciel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Priorité</Label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basse">Basse</SelectItem>
                  <SelectItem value="moyenne">Moyenne</SelectItem>
                  <SelectItem value="haute">Haute</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Titre</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Justification</Label>
              <Textarea rows={4} value={form.rationale} onChange={(e) => setForm((f) => ({ ...f, rationale: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={submit}>Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}

      {SUGGESTION_COLUMNS.map((col) => {
        const items = rows.filter((r: any) => r.status === col.key);
        if (items.length === 0 && (col.key === "adopte" || col.key === "rejete")) return null;
        return (
          <div key={col.key}>
            <p className="text-[10px] tracking-widest uppercase text-muted-foreground mb-2">{col.label} · {items.length}</p>
            <div className="space-y-2.5">
              {items.map((s: any) => (
                <div key={s.id} className="border border-border rounded-lg p-3.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {s.target === "produit_physique" ? "Produit physique" : "Catalogue"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">{s.priority}</Badge>
                  </div>
                  <p className="text-sm font-medium leading-snug">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.rationale}</p>
                  {col.key !== "adopte" && col.key !== "rejete" && (
                    <div className="flex gap-2 mt-3">
                      {col.key === "propose" && (
                        <button onClick={() => move(s.id, "a_l_etude")} className="text-[10px] uppercase tracking-widest text-accent">
                          → À l'étude
                        </button>
                      )}
                      {col.key === "a_l_etude" && (
                        <>
                          <button onClick={() => move(s.id, "adopte")} className="text-[10px] uppercase tracking-widest text-emerald-700">Adopter</button>
                          <button onClick={() => move(s.id, "rejete")} className="text-[10px] uppercase tracking-widest text-red-700">Rejeter</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {items.length === 0 && <p className="text-xs text-muted-foreground">Aucune suggestion.</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
