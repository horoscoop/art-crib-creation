import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Eye, Upload, Loader2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { analyzeKoaVision } from "@/lib/vision.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/vision")({
  head: () => ({ meta: [{ title: "KOA Vision — Diagnostic IA" }] }),
  component: VisionPage,
});

type ImgItem = { label: string; data_url: string };

function VisionPage() {
  const run = useServerFn(analyzeKoaVision);
  const { user } = useAuth();
  const [mode, setMode] = useState<"recommendation" | "diagnostic">("recommendation");
  const [images, setImages] = useState<ImgItem[]>([]);
  const [ctx, setCtx] = useState({ weight_kg: "", height_m: "", age_years: "", location: "", notes: "" });
  const [artworkId, setArtworkId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reply, setReply] = useState<string>("");

  const { data: artworks = [] } = useQuery({
    queryKey: ["artworks-mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("artworks")
        .select("id, title, location").order("title");
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
    setReply("");
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
      setReply(r.reply);
    } catch (e: any) {
      toast.error(e.message || "Analyse indisponible");
    } finally {
      setLoading(false);
    }
  };

  const attachToArtwork = async () => {
    if (!artworkId) return toast.error("Choisissez une œuvre.");
    if (!reply) return;
    setSaving(true);
    try {
      const kind = mode === "recommendation" ? "vision_recommandation" : "vision_diagnostic";
      const header = `[KOA Vision — ${mode === "recommendation" ? "Recommandation" : "Diagnostic"}]`;
      const { error } = await supabase.from("maintenance_logs").insert({
        artwork_id: artworkId,
        performed_by: user?.id ?? null,
        kind,
        description: `${header}\n\n${reply}`,
      });
      if (error) throw error;
      // Upload photos as attachments
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

  return (
    <main className="max-w-md mx-auto px-5 pt-8 pb-12">
      <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
        <Eye className="size-3.5" /> KOA Vision
      </div>
      <h1 className="serif text-3xl mt-2">Diagnostic IA visuel</h1>
      <p className="text-sm text-muted-foreground mt-2">
        Photographiez l'œuvre et le mur (mode recommandation) ou un système installé (mode diagnostic). L'IA propose un kit KOA ou détecte les signatures de défaillance.
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
        <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Contexte (optionnel)</Label>
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Poids kg" value={ctx.weight_kg} onChange={(e) => setCtx({ ...ctx, weight_kg: e.target.value })} />
          <Input placeholder="Haut. m" value={ctx.height_m} onChange={(e) => setCtx({ ...ctx, height_m: e.target.value })} />
          <Input placeholder="Âge ans" value={ctx.age_years} onChange={(e) => setCtx({ ...ctx, age_years: e.target.value })} />
        </div>
        <Input placeholder="Emplacement / type de mur" value={ctx.location} onChange={(e) => setCtx({ ...ctx, location: e.target.value })} />
        <Textarea placeholder="Notes" rows={2} value={ctx.notes} onChange={(e) => setCtx({ ...ctx, notes: e.target.value })} />
      </section>

      <Button onClick={submit} disabled={loading} className="mt-6 w-full">
        {loading ? <><Loader2 className="size-4 mr-2 animate-spin" /> Analyse en cours…</> : "Lancer l'analyse"}
      </Button>

      {reply && (
        <section className="mt-8 border-t border-border pt-6">
          <h2 className="serif text-xl">Rapport KOA Vision</h2>
          <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed font-sans">{reply}</pre>

          <div className="mt-6 border border-border p-4">
            <p className="text-[10px] tracking-widest uppercase text-muted-foreground flex items-center gap-2">
              <Link2 className="size-3.5" /> Rattacher à une œuvre
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Le rapport sera ajouté au journal de maintenance de la fiche, et les photos archivées en pièces jointes.
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
