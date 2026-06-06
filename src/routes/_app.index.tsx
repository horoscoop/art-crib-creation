import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { StatusBadge } from "@/components/koa/status-badge";
import { computeSeverity, signedPhoto } from "@/lib/koa-helpers";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Parc d'œuvres — KOA Guardian" }] }),
  component: Dashboard,
});

type ArtworkRow = {
  id: string; title: string; artist: string | null; location: string | null;
  weight_kg: number; photo_url: string | null;
  site: string | null; room: string | null; zone: string | null;
  fixation_type: string | null; criticality: string | null;
};

function Dashboard() {
  const { user, signOut } = useAuth();
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [critFilter, setCritFilter] = useState<string>("all");

  const { data: artworksRaw = [] } = useQuery({
    queryKey: ["artworks", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artworks").select("id,title,artist,location,weight_kg,photo_url,site,room,zone,fixation_type,criticality")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ArtworkRow[];
    },
    enabled: !!user,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts-active", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts").select("artwork_id, severity").eq("resolved", false);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const alertsByArtwork = new Map<string, Array<{ severity: string }>>();
  for (const a of alerts) {
    if (!alertsByArtwork.has(a.artwork_id)) alertsByArtwork.set(a.artwork_id, []);
    alertsByArtwork.get(a.artwork_id)!.push({ severity: a.severity });
  }

  const critical = alerts.filter((a) => a.severity === "critical").length;
  const vigilance = alerts.filter((a) => a.severity === "vigilance").length;

  const sites = Array.from(new Set(artworksRaw.map((a) => a.site).filter(Boolean))) as string[];

  const artworks = artworksRaw.filter((a) => {
    if (siteFilter !== "all" && a.site !== siteFilter) return false;
    if (critFilter !== "all" && (a.criticality ?? "standard") !== critFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [a.title, a.artist, a.location, a.site, a.room, a.zone].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <main className="max-w-md mx-auto px-5 pt-10">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground">Kingdom of Arts</p>
          <h1 className="serif text-4xl mt-1">Mon parc</h1>
        </div>
        <button onClick={signOut} className="text-[10px] tracking-widest uppercase text-muted-foreground">
          Sortir
        </button>
      </header>

      <section className="mt-8 grid grid-cols-3 gap-px bg-border border border-border">
        <Stat label="Œuvres" value={artworksRaw.length} />
        <Stat label="Vigilance" value={vigilance} tone={vigilance > 0 ? "vigilance" : undefined} />
        <Stat label="Critique" value={critical} tone={critical > 0 ? "critical" : undefined} />
      </section>

      <div className="mt-6 space-y-2">
        <input
          type="search"
          placeholder="Rechercher titre, artiste, salle…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm bg-transparent border-b border-border focus:outline-none focus:border-foreground py-2"
        />
        <div className="flex gap-2 text-[10px] tracking-widest uppercase">
          <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}
            className="flex-1 bg-transparent border border-border px-2 py-1.5">
            <option value="all">Tous les sites</option>
            {sites.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={critFilter} onChange={(e) => setCritFilter(e.target.value)}
            className="flex-1 bg-transparent border border-border px-2 py-1.5">
            <option value="all">Toutes criticités</option>
            <option value="standard">Standard</option>
            <option value="elevee">Élevée</option>
            <option value="critique">Critique</option>
          </select>
        </div>
      </div>

      <div className="mt-6 flex items-baseline justify-between">
        <h2 className="serif text-xl">Installations</h2>
        <Link to="/artworks/new" className="inline-flex items-center gap-1.5 text-xs tracking-widest uppercase text-accent">
          <Plus className="size-3.5" /> Ajouter
        </Link>
      </div>

      <ul className="mt-4 space-y-3">
        {artworks.length === 0 && (
          <li className="border border-dashed border-border p-8 text-center">
            <Building2 className="size-6 mx-auto text-muted-foreground" strokeWidth={1.2} />
            <p className="mt-3 text-sm text-muted-foreground">
              {artworksRaw.length === 0 ? "Aucune œuvre enregistrée." : "Aucun résultat avec ces filtres."}
            </p>
            {artworksRaw.length === 0 && (
              <Link to="/artworks/new" className="mt-4 inline-block text-xs underline underline-offset-4">
                Créer la première fiche
              </Link>
            )}
          </li>
        )}
        {artworks.map((a) => (
          <ArtworkCard key={a.id} a={a} severity={computeSeverity(alertsByArtwork.get(a.id) ?? [])} />
        ))}
      </ul>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "vigilance" | "critical" }) {
  return (
    <div className="bg-card p-4 text-center">
      <div className={`serif text-3xl ${tone === "critical" ? "text-destructive" : tone === "vigilance" ? "text-vigilance" : ""}`}>
        {value}
      </div>
      <div className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function ArtworkCard({ a, severity }: { a: ArtworkRow; severity: "ok" | "vigilance" | "critical" }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { signedPhoto(a.photo_url).then(setSrc); }, [a.photo_url]);

  return (
    <li>
      <Link to="/artworks/$id" params={{ id: a.id }} className="block group">
        <div className="flex gap-4 items-start border border-border bg-card p-3 hover:border-foreground/40 transition-colors">
          <div className="size-20 bg-secondary shrink-0 overflow-hidden">
            {src ? (
              <img src={src} alt={a.title} className="size-full object-cover" />
            ) : (
              <div className="size-full grid place-items-center text-muted-foreground">
                <Building2 className="size-5" strokeWidth={1.2} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="serif text-lg leading-tight truncate">{a.title}</h3>
              <StatusBadge severity={severity} />
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">{a.artist ?? "—"}</p>
            <p className="text-[11px] text-muted-foreground mt-2 truncate">
              {[a.site, a.room, a.zone].filter(Boolean).join(" · ") || a.location || "Lieu non renseigné"}
              {" · "}<span className="mono">{a.weight_kg} kg</span>
            </p>
            <div className="mt-1.5 flex gap-1.5 flex-wrap">
              {a.criticality && a.criticality !== "standard" && (
                <span className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 border ${a.criticality === "critique" ? "border-destructive text-destructive" : "border-vigilance text-vigilance"}`}>
                  {a.criticality === "critique" ? "Critique" : "Élevée"}
                </span>
              )}
              {a.fixation_type && (
                <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border border-border text-muted-foreground">
                  {a.fixation_type}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}
