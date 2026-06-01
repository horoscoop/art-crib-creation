import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronLeft, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { listAllExpertises, createExpertise } from "@/lib/expertises.functions";
import { useRoles } from "@/lib/use-roles";
import { formatDateTime } from "@/lib/koa-helpers";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/expertises")({
  head: () => ({ meta: [{ title: "Expertises KOA — KOA Guardian" }] }),
  component: ExpertisesPage,
});

function ExpertisesPage() {
  const list = useServerFn(listAllExpertises);
  const { data: rows = [] } = useQuery({ queryKey: ["expertises-all"], queryFn: () => list() });

  return (
    <main className="max-w-md mx-auto px-5 pt-8 pb-12">
      <Link to="/" className="inline-flex items-center gap-1 text-xs tracking-widest uppercase text-muted-foreground">
        <ChevronLeft className="size-4" /> Parc
      </Link>
      <header className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground">Bureau d'expertise</p>
          <h1 className="serif text-3xl mt-1">Expertises KOA</h1>
        </div>
        <FileSignature className="size-5 text-muted-foreground" />
      </header>

      <ul className="mt-8 space-y-5">
        {rows.length === 0 && <li className="text-sm text-muted-foreground">Aucune expertise enregistrée.</li>}
        {rows.map((r: any) => (
          <li key={r.id} className="border-l-2 border-foreground/40 pl-4">
            <p className="text-[10px] mono uppercase tracking-widest text-muted-foreground">
              {formatDateTime(r.performed_at)} · {r.type}
            </p>
            <Link to="/artworks/$id" params={{ id: r.artwork_id }} className="serif text-lg block mt-1 underline-offset-4 hover:underline">
              {r.artworks?.title ?? "—"}
            </Link>
            <p className="text-sm mt-2 whitespace-pre-wrap">{r.rapport}</p>
            {r.recommandations && (
              <p className="text-xs mt-2 text-muted-foreground"><span className="uppercase tracking-widest text-[10px]">Recommandations</span><br />{r.recommandations}</p>
            )}
            {(r.kit_recommande || r.charge_mesuree_kg) && (
              <p className="text-[10px] mono uppercase tracking-widest text-muted-foreground mt-2">
                {r.charge_mesuree_kg && <>Charge mesurée {r.charge_mesuree_kg} kg</>}
                {r.kit_recommande && <> · Kit {r.kit_recommande}</>}
              </p>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

export function NewExpertiseDialog({ artworkId }: { artworkId: string }) {
  const { isAdminOrExpert } = useRoles();
  const qc = useQueryClient();
  const create = useServerFn(createExpertise);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"installation" | "audit" | "incident" | "transfert">("audit");
  const [rapport, setRapport] = useState("");
  const [reco, setReco] = useState("");
  const [charge, setCharge] = useState("");
  const [kit, setKit] = useState("");

  if (!isAdminOrExpert) return null;

  const submit = async () => {
    if (!rapport.trim()) return toast.error("Le rapport est requis");
    try {
      await create({ data: {
        artwork_id: artworkId, type, rapport, recommandations: reco || undefined,
        charge_mesuree_kg: charge ? Number(charge) : undefined,
        kit_recommande: kit || undefined,
      }});
      toast.success("Expertise enregistrée");
      qc.invalidateQueries({ queryKey: ["expertises", artworkId] });
      qc.invalidateQueries({ queryKey: ["expertises-all"] });
      setOpen(false); setRapport(""); setReco(""); setCharge(""); setKit("");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="text-xs tracking-widest uppercase text-accent">+ Expertise</DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="serif text-2xl font-normal">Rapport d'expertise</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Type</Label>
            <select value={type} onChange={(e) => setType(e.target.value as any)}
              className="w-full mt-1 border-0 border-b border-border bg-transparent h-9 text-sm focus:outline-none">
              <option value="audit">Audit</option>
              <option value="installation">Installation</option>
              <option value="incident">Incident</option>
              <option value="transfert">Transfert</option>
            </select>
          </div>
          <div>
            <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Rapport</Label>
            <Textarea rows={6} value={rapport} onChange={(e) => setRapport(e.target.value)}
              className="mt-1 rounded-sm border-0 border-b border-border bg-transparent px-0" />
          </div>
          <div>
            <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Recommandations</Label>
            <Textarea rows={3} value={reco} onChange={(e) => setReco(e.target.value)}
              className="mt-1 rounded-sm border-0 border-b border-border bg-transparent px-0" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Charge mesurée (kg)</Label>
              <Input type="number" step="0.1" value={charge} onChange={(e) => setCharge(e.target.value)}
                className="mt-1 rounded-sm border-0 border-b border-border bg-transparent px-0 h-9" />
            </div>
            <div>
              <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Kit recommandé</Label>
              <Input value={kit} onChange={(e) => setKit(e.target.value)}
                className="mt-1 rounded-sm border-0 border-b border-border bg-transparent px-0 h-9" />
            </div>
          </div>
          <Button onClick={submit} className="w-full rounded-sm h-10 text-xs tracking-widest uppercase">Signer le rapport</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
