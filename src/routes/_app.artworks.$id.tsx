import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronLeft, Trash2, Activity, Paperclip, FileSignature, ClipboardCheck } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/koa/status-badge";
import { computeSeverity, signedPhoto, formatDate, formatDateTime } from "@/lib/koa-helpers";
import { toast } from "sonner";
import { NewInspectionDialog } from "@/routes/_app.inspections";
import { NewExpertiseDialog } from "@/routes/_app.expertises";

export const Route = createFileRoute("/_app/artworks/$id")({
  head: () => ({ meta: [{ title: "Fiche œuvre — KOA Guardian" }] }),
  component: ArtworkDetail,
});

function ArtworkDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [photo, setPhoto] = useState<string | null>(null);

  const { data: artwork } = useQuery({
    queryKey: ["artwork", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("artworks").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: readings = [] } = useQuery({
    queryKey: ["readings", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sensor_readings")
        .select("*").eq("artwork_id", id).order("recorded_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("alerts")
        .select("*").eq("artwork_id", id).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["logs", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("maintenance_logs")
        .select("*").eq("artwork_id", id).order("performed_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (artwork?.photo_url) signedPhoto(artwork.photo_url).then(setPhoto);
  }, [artwork?.photo_url]);

  if (!artwork) return <div className="p-8 text-center text-muted-foreground text-xs">…</div>;

  const activeAlerts = alerts.filter((a) => !a.resolved);
  const severity = computeSeverity(activeAlerts);

  const latest = readings[0];
  const chartData = [...readings].reverse().map((r) => ({
    t: new Date(r.recorded_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
    humidity: r.humidity_pct,
    temperature: r.temperature_c,
    tilt: r.tilt_deg,
  }));

  const deleteArtwork = async () => {
    if (!confirm("Supprimer cette œuvre et tout son historique ?")) return;
    await supabase.from("artworks").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["artworks"] });
    navigate({ to: "/" });
  };

  return (
    <main className="max-w-md mx-auto pb-12">
      <div className="px-5 pt-6 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-1 text-xs tracking-widest uppercase text-muted-foreground">
          <ChevronLeft className="size-4" /> Parc
        </Link>
        <button onClick={deleteArtwork} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="size-4" />
        </button>
      </div>

      {photo && (
        <div className="aspect-[4/3] mt-4 bg-secondary overflow-hidden">
          <img src={photo} alt={artwork.title} className="size-full object-cover" />
        </div>
      )}

      <div className="px-5 mt-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">{artwork.artist ?? "Artiste inconnu"}</p>
            <h1 className="serif text-3xl mt-1">{artwork.title}</h1>
          </div>
          <StatusBadge severity={severity} />
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-y-3 text-sm">
          <Meta label="Emplacement" value={artwork.location ?? "—"} />
          <Meta label="Poids" value={<span className="mono">{artwork.weight_kg} kg</span>} />
          <Meta label="Type de mur" value={artwork.wall_type ?? "—"} />
          <Meta label="Système" value={artwork.koa_system ?? "—"} />
          <Meta label="Posée le" value={formatDate(artwork.install_date)} />
          <Meta label="Charge × 4" value={<span className="mono">{(artwork.weight_kg * 4).toFixed(1)} kg</span>} />
        </dl>

        {/* Alertes actives */}
        {activeAlerts.length > 0 && (
          <section className="mt-8">
            <h2 className="serif text-xl">Alertes actives</h2>
            <ul className="mt-3 space-y-2">
              {activeAlerts.map((a) => (
                <li key={a.id} className={`border-l-2 ${a.severity === "critical" ? "border-destructive" : "border-vigilance"} bg-card p-3`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{a.kind}</span>
                    <button onClick={async () => {
                      await supabase.from("alerts").update({ resolved: true, resolved_at: new Date().toISOString() }).eq("id", a.id);
                      qc.invalidateQueries({ queryKey: ["alerts", id] });
                      qc.invalidateQueries({ queryKey: ["alerts-active"] });
                    }} className="text-[10px] uppercase tracking-widest text-muted-foreground underline">
                      Résoudre
                    </button>
                  </div>
                  <p className="text-sm mt-1">{a.message}</p>
                  <p className="text-[10px] mono text-muted-foreground mt-1">{formatDateTime(a.created_at)}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Dernière mesure */}
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="serif text-xl">Capteurs</h2>
            <NewReadingDialog artworkId={id} />
          </div>
          {latest ? (
            <div className="mt-3 grid grid-cols-2 gap-px bg-border border border-border">
              <Cell label="Humidité" value={latest.humidity_pct} unit="%" />
              <Cell label="Température" value={latest.temperature_c} unit="°C" />
              <Cell label="Inclinaison" value={latest.tilt_deg} unit="°" />
              <Cell label="Fluage" value={latest.drift_mm} unit="mm" />
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Aucune mesure pour le moment.</p>
          )}

          {chartData.length > 1 && (
            <div className="mt-6 h-40 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="t" tick={{ fontSize: 9 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 9 }} stroke="var(--muted-foreground)" width={28} />
                  <Tooltip contentStyle={{ fontSize: 11, background: "var(--card)", border: "1px solid var(--border)" }} />
                  <Line type="monotone" dataKey="humidity" stroke="var(--chart-2)" dot={false} strokeWidth={1.5} />
                  <Line type="monotone" dataKey="temperature" stroke="var(--chart-1)" dot={false} strokeWidth={1.5} />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-muted-foreground tracking-widest uppercase text-center mt-1">
                <span className="inline-flex items-center gap-1"><span className="size-2 bg-chart-2" /> Humidité</span>
                <span className="mx-3">·</span>
                <span className="inline-flex items-center gap-1"><span className="size-2 bg-chart-1" /> Température</span>
              </p>
            </div>
          )}
        </section>

        {/* Maintenance */}
        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="serif text-xl">Maintenance</h2>
            <NewMaintenanceDialog artworkId={id} />
          </div>
          <ul className="mt-3 space-y-3">
            {logs.length === 0 && <p className="text-sm text-muted-foreground">Aucun audit enregistré.</p>}
            {logs.map((l) => (
              <li key={l.id} className="border-l border-border pl-4">
                <p className="text-[10px] mono uppercase tracking-widest text-muted-foreground">
                  {formatDateTime(l.performed_at)} · {l.kind}
                </p>
                <p className="text-sm mt-1">{l.description}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Webhook info pour IoT */}
        <section className="mt-10 border border-dashed border-border p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Activity className="size-3.5" /> Ingestion IoT
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Vos capteurs peuvent envoyer leurs mesures vers&nbsp;:
          </p>
          <code className="block mt-2 text-[10px] mono break-all p-2 bg-secondary">
            POST /api/public/sensors/ingest
          </code>
          <p className="text-[10px] text-muted-foreground mt-2">
            Body : <span className="mono">{`{"artwork_id":"${id}","humidity_pct":68,"tilt_deg":0.4}`}</span>
          </p>
        </section>
      </div>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

function Cell({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="bg-card p-4">
      <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">{label}</div>
      <div className="serif text-2xl mt-1">
        {value ?? "—"}<span className="text-sm text-muted-foreground ml-1">{value !== null ? unit : ""}</span>
      </div>
    </div>
  );
}

function NewReadingDialog({ artworkId }: { artworkId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ humidity_pct: "", temperature_c: "", tilt_deg: "", drift_mm: "", tension_n: "" });
  const submit = async () => {
    const payload = {
      artwork_id: artworkId,
      source: "manual",
      humidity_pct: f.humidity_pct ? Number(f.humidity_pct) : null,
      temperature_c: f.temperature_c ? Number(f.temperature_c) : null,
      tilt_deg: f.tilt_deg ? Number(f.tilt_deg) : null,
      drift_mm: f.drift_mm ? Number(f.drift_mm) : null,
      tension_n: f.tension_n ? Number(f.tension_n) : null,
    };
    const { error } = await supabase.from("sensor_readings").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Mesure enregistrée");
    qc.invalidateQueries({ queryKey: ["readings", artworkId] });
    qc.invalidateQueries({ queryKey: ["alerts", artworkId] });
    qc.invalidateQueries({ queryKey: ["alerts-active"] });
    setOpen(false);
    setF({ humidity_pct: "", temperature_c: "", tilt_deg: "", drift_mm: "", tension_n: "" });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="text-xs tracking-widest uppercase text-accent">+ Mesure</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="serif text-2xl font-normal">Relevé</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {[
            ["humidity_pct", "Humidité (%)"],
            ["temperature_c", "Température (°C)"],
            ["tilt_deg", "Inclinaison (°)"],
            ["drift_mm", "Fluage (mm)"],
            ["tension_n", "Tension (N)"],
          ].map(([k, l]) => (
            <div key={k}>
              <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">{l}</Label>
              <Input type="number" step="0.01" value={f[k as keyof typeof f]}
                onChange={(e) => setF({ ...f, [k]: e.target.value })}
                className="mt-1 rounded-sm border-0 border-b border-border bg-transparent px-0 h-9" />
            </div>
          ))}
          <Button onClick={submit} className="w-full rounded-sm h-10 text-xs tracking-widest uppercase">Enregistrer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewMaintenanceDialog({ artworkId }: { artworkId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("inspection");
  const [desc, setDesc] = useState("");
  const submit = async () => {
    if (!desc) return;
    const { error } = await supabase.from("maintenance_logs").insert({ artwork_id: artworkId, kind, description: desc });
    if (error) return toast.error(error.message);
    toast.success("Entrée ajoutée");
    qc.invalidateQueries({ queryKey: ["logs", artworkId] });
    setOpen(false); setDesc("");
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="text-xs tracking-widest uppercase text-accent">+ Entrée</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="serif text-2xl font-normal">Journal de maintenance</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Type</Label>
            <select value={kind} onChange={(e) => setKind(e.target.value)}
              className="w-full mt-1 border-0 border-b border-border bg-transparent h-9 text-sm focus:outline-none focus:border-foreground">
              <option value="inspection">Inspection visuelle</option>
              <option value="audit">Audit annuel</option>
              <option value="nettoyage">Nettoyage</option>
              <option value="remplacement">Remplacement</option>
              <option value="installation">Installation</option>
            </select>
          </div>
          <div>
            <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Constat</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4}
              className="mt-1 rounded-sm border-0 border-b border-border bg-transparent px-0" />
          </div>
          <Button onClick={submit} className="w-full rounded-sm h-10 text-xs tracking-widest uppercase">Enregistrer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
