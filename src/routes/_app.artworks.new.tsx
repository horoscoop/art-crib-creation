import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/artworks/new")({
  head: () => ({ meta: [{ title: "Nouvelle œuvre — KOA Guardian" }] }),
  component: NewArtwork,
});

const MAX_PHOTOS = 6;

function NewArtwork() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [form, setForm] = useState({
    title: "", artist: "", location: "",
    site: "", room: "", zone: "",
    weight_kg: "", wall_type: "Placo", koa_system: "",
    fixation_type: "", criticality: "standard",
    install_date: "", notes: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const pickPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) { toast.error(`Maximum ${MAX_PHOTOS} photos`); return; }
    const next = files.slice(0, room).map((f) => ({ file: f, preview: URL.createObjectURL(f) }));
    setPhotos((p) => [...p, ...next]);
    e.target.value = "";
  };

  const removePhoto = (idx: number) => {
    setPhotos((p) => {
      URL.revokeObjectURL(p[idx].preview);
      return p.filter((_, i) => i !== idx);
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const uploaded: string[] = [];
      for (const { file } of photos) {
        const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("artwork-photos").upload(path, file);
        if (upErr) { toast.error(`Upload ${file.name}: ${upErr.message}`); continue; }
        uploaded.push(path);
      }
      const { data, error } = await supabase.from("artworks").insert({
        owner_id: user.id,
        title: form.title,
        artist: form.artist || null,
        location: form.location || null,
        site: form.site || null,
        room: form.room || null,
        zone: form.zone || null,
        weight_kg: Number(form.weight_kg),
        wall_type: form.wall_type || null,
        koa_system: form.koa_system || null,
        fixation_type: form.fixation_type || null,
        criticality: form.criticality,
        install_date: form.install_date || null,
        notes: form.notes || null,
        photo_url: uploaded[0] ?? null,
        photo_urls: uploaded,
      }).select("id").single();
      if (error) throw error;
      toast.success("Œuvre enregistrée");
      navigate({ to: "/artworks/$id", params: { id: data.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto px-5 pt-8 pb-12">
      <Link to="/" className="inline-flex items-center gap-1 text-xs tracking-widest uppercase text-muted-foreground">
        <ChevronLeft className="size-4" /> Parc
      </Link>
      <h1 className="serif text-3xl mt-4">Nouvelle installation</h1>
      <p className="text-sm text-muted-foreground mt-1">État zéro de référence.</p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <div>
          <Label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
            Photos d'état zéro ({photos.length}/{MAX_PHOTOS})
          </Label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative aspect-square bg-secondary overflow-hidden group">
                <img src={p.preview} alt="" className="size-full object-cover" />
                <button type="button" onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 size-6 grid place-items-center bg-background/90 text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="size-3" />
                </button>
                {i === 0 && (
                  <span className="absolute bottom-1 left-1 text-[9px] uppercase tracking-widest bg-background/80 px-1.5 py-0.5">
                    Principale
                  </span>
                )}
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className="aspect-square bg-secondary border border-dashed border-border grid place-items-center cursor-pointer hover:border-foreground">
                <div className="text-center text-muted-foreground">
                  <Upload className="size-4 mx-auto" strokeWidth={1.2} />
                  <p className="mt-1 text-[9px] tracking-widest uppercase">Ajouter</p>
                </div>
                <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={pickPhotos} />
              </label>
            )}
          </div>
        </div>

        <Field label="Titre de l'œuvre" value={form.title} onChange={set("title")} required />
        <Field label="Artiste" value={form.artist} onChange={set("artist")} />
        <Field label="Emplacement (libre)" value={form.location} onChange={set("location")} placeholder="Salle, étage, ville…" />

        <div className="grid grid-cols-3 gap-4">
          <Field label="Site" value={form.site} onChange={set("site")} placeholder="Musée X" />
          <Field label="Salle" value={form.room} onChange={set("room")} placeholder="Salle 12" />
          <Field label="Zone" value={form.zone} onChange={set("zone")} placeholder="Mur Nord" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Poids (kg)" type="number" step="0.1" value={form.weight_kg} onChange={set("weight_kg")} required />
          <Field label="Type de mur" value={form.wall_type} onChange={set("wall_type")} />
        </div>
        <Field label="Système KOA utilisé" value={form.koa_system} onChange={set("koa_system")} placeholder="Rail, câble, adhésif structural…" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type de fixation" value={form.fixation_type} onChange={set("fixation_type")} placeholder="Crochet, rail, vis chimique…" />
          <div>
            <Label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Criticité</Label>
            <select
              value={form.criticality}
              onChange={(e) => setForm({ ...form, criticality: e.target.value })}
              className="mt-1 w-full rounded-sm border-0 border-b border-border bg-transparent focus-visible:outline-none focus-visible:border-foreground px-0 h-10 text-sm"
            >
              <option value="standard">Standard</option>
              <option value="elevee">Élevée</option>
              <option value="critique">Critique</option>
            </select>
          </div>
        </div>
        <Field label="Date d'installation" type="date" value={form.install_date} onChange={set("install_date")} />

        <div>
          <Label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Notes</Label>
          <Textarea value={form.notes} onChange={set("notes")} rows={3}
            className="mt-1 rounded-sm border-0 border-b border-border bg-transparent focus-visible:ring-0 focus-visible:border-foreground px-0" />
        </div>

        <Button type="submit" disabled={loading} className="w-full rounded-sm h-11 text-xs tracking-[0.2em] uppercase">
          Enregistrer l'œuvre
        </Button>
      </form>
    </main>
  );
}

function Field({ label, value, onChange, type = "text", required, placeholder, step }: {
  label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string; required?: boolean; placeholder?: string; step?: string;
}) {
  return (
    <div>
      <Label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={onChange} required={required} placeholder={placeholder} step={step}
        className="mt-1 rounded-sm border-0 border-b border-border bg-transparent focus-visible:ring-0 focus-visible:border-foreground px-0 h-10" />
    </div>
  );
}
