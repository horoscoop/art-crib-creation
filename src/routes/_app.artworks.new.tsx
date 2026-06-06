import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, Upload } from "lucide-react";
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

function NewArtwork() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", artist: "", location: "",
    site: "", room: "", zone: "",
    weight_kg: "", wall_type: "Placo", koa_system: "",
    fixation_type: "", criticality: "standard",
    install_date: "", notes: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      let photo_url: string | null = null;
      if (photoFile) {
        const path = `${user.id}/${crypto.randomUUID()}-${photoFile.name}`;
        const { error: upErr } = await supabase.storage.from("artwork-photos").upload(path, photoFile);
        if (upErr) throw upErr;
        photo_url = path;
      }
      const { data, error } = await supabase.from("artworks").insert({
        owner_id: user.id,
        title: form.title,
        artist: form.artist || null,
        location: form.location || null,
        weight_kg: Number(form.weight_kg),
        wall_type: form.wall_type || null,
        koa_system: form.koa_system || null,
        install_date: form.install_date || null,
        notes: form.notes || null,
        photo_url,
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
    <main className="max-w-md mx-auto px-5 pt-8">
      <Link to="/" className="inline-flex items-center gap-1 text-xs tracking-widest uppercase text-muted-foreground">
        <ChevronLeft className="size-4" /> Parc
      </Link>
      <h1 className="serif text-3xl mt-4">Nouvelle installation</h1>
      <p className="text-sm text-muted-foreground mt-1">État zéro de référence.</p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <label className="block">
          <div className="aspect-[4/3] w-full bg-secondary border border-dashed border-border grid place-items-center overflow-hidden">
            {photoPreview ? (
              <img src={photoPreview} alt="" className="size-full object-cover" />
            ) : (
              <div className="text-center text-muted-foreground">
                <Upload className="size-5 mx-auto" strokeWidth={1.2} />
                <p className="mt-2 text-[10px] tracking-widest uppercase">Photo état zéro</p>
              </div>
            )}
          </div>
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pickPhoto} />
        </label>

        <Field label="Titre de l'œuvre" value={form.title} onChange={set("title")} required />
        <Field label="Artiste" value={form.artist} onChange={set("artist")} />
        <Field label="Emplacement" value={form.location} onChange={set("location")} placeholder="Salle, étage, ville…" />

        <div className="grid grid-cols-2 gap-4">
          <Field label="Poids (kg)" type="number" step="0.1" value={form.weight_kg} onChange={set("weight_kg")} required />
          <Field label="Type de mur" value={form.wall_type} onChange={set("wall_type")} />
        </div>
        <Field label="Système KOA utilisé" value={form.koa_system} onChange={set("koa_system")} placeholder="Rail, câble, adhésif structural…" />
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
