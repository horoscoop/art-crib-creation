import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ChevronLeft, Trash2, Activity, Paperclip, FileSignature, ClipboardCheck, ShieldCheck, Download, ArrowRightLeft } from "lucide-react";
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
import { transferArtwork } from "@/lib/trace.functions";
import { generateCertificatePdf } from "@/lib/certificate";

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

        {/* Suivi périodique */}
        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="serif text-xl flex items-center gap-2"><ClipboardCheck className="size-4" /> Suivi périodique</h2>
            <NewInspectionDialog artworkId={id} />
          </div>
          <InspectionsList artworkId={id} />
        </section>

        {/* Expertises KOA */}
        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="serif text-xl flex items-center gap-2"><FileSignature className="size-4" /> Expertises KOA</h2>
            <NewExpertiseDialog artworkId={id} />
          </div>
          <ExpertisesList artworkId={id} />
        </section>

        {/* Pièces jointes */}
        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="serif text-xl flex items-center gap-2"><Paperclip className="size-4" /> Pièces jointes</h2>
            <AttachmentUpload artworkId={id} />
          </div>
          <AttachmentList artworkId={id} />
        </section>

        {/* KOA Trace — carte d'identité phygitale */}
        <TraceSection artwork={artwork} />

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

function InspectionsList({ artworkId }: { artworkId: string }) {
  const { data: rows = [] } = useQuery({
    queryKey: ["inspections", artworkId],
    queryFn: async () => {
      const { data } = await supabase.from("inspections").select("*").eq("artwork_id", artworkId).order("performed_at", { ascending: false });
      return data ?? [];
    },
  });
  if (!rows.length) return <p className="mt-3 text-sm text-muted-foreground">Aucune inspection enregistrée.</p>;
  return (
    <ul className="mt-3 space-y-3">
      {rows.map((r: any) => (
        <li key={r.id} className="border-l border-border pl-4">
          <p className="text-[10px] mono uppercase tracking-widest text-muted-foreground">
            {formatDateTime(r.performed_at)} · {r.period_type}
            {r.next_due_at && <> · prochaine {formatDate(r.next_due_at)}</>}
          </p>
          {r.notes && <p className="text-sm mt-1">{r.notes}</p>}
          <p className="text-[10px] mt-1 text-muted-foreground">Score <span className="mono">{r.score_global != null ? Number(r.score_global).toFixed(2) : "—"}</span></p>
        </li>
      ))}
    </ul>
  );
}

function ExpertisesList({ artworkId }: { artworkId: string }) {
  const { data: rows = [] } = useQuery({
    queryKey: ["expertises", artworkId],
    queryFn: async () => {
      const { data } = await supabase.from("expertises").select("*").eq("artwork_id", artworkId).order("performed_at", { ascending: false });
      return data ?? [];
    },
  });
  if (!rows.length) return <p className="mt-3 text-sm text-muted-foreground">Aucune expertise.</p>;
  return (
    <ul className="mt-3 space-y-3">
      {rows.map((r: any) => (
        <li key={r.id} className="border-l-2 border-foreground/40 pl-4">
          <p className="text-[10px] mono uppercase tracking-widest text-muted-foreground">{formatDateTime(r.performed_at)} · {r.type}</p>
          <p className="text-sm mt-1 whitespace-pre-wrap">{r.rapport}</p>
          {r.recommandations && <p className="text-xs text-muted-foreground mt-1">{r.recommandations}</p>}
        </li>
      ))}
    </ul>
  );
}

function AttachmentUpload({ artworkId }: { artworkId: string }) {
  const qc = useQueryClient();
  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    for (const f of Array.from(files)) {
      const path = `${artworkId}/${Date.now()}-${f.name}`;
      const { error } = await supabase.storage.from("artwork-attachments").upload(path, f);
      if (error) { toast.error(error.message); continue; }
      await supabase.from("attachments").insert({
        artwork_id: artworkId, storage_path: path, filename: f.name,
        mime_type: f.type, size_bytes: f.size,
      });
    }
    toast.success("Téléversé");
    qc.invalidateQueries({ queryKey: ["attachments", artworkId] });
    e.target.value = "";
  };
  return (
    <label className="text-xs tracking-widest uppercase text-accent cursor-pointer">
      + Fichier
      <input type="file" multiple className="hidden" onChange={onChange} />
    </label>
  );
}

function AttachmentList({ artworkId }: { artworkId: string }) {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["attachments", artworkId],
    queryFn: async () => {
      const { data } = await supabase.from("attachments").select("*").eq("artwork_id", artworkId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const open = async (path: string) => {
    const { data } = await supabase.storage.from("artwork-attachments").createSignedUrl(path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };
  const remove = async (id: string, path: string) => {
    if (!confirm("Supprimer ce fichier ?")) return;
    await supabase.storage.from("artwork-attachments").remove([path]);
    await supabase.from("attachments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["attachments", artworkId] });
  };
  if (!rows.length) return <p className="mt-3 text-sm text-muted-foreground">Aucun document.</p>;
  return (
    <ul className="mt-3 divide-y divide-border border-y border-border">
      {rows.map((a: any) => (
        <li key={a.id} className="flex items-center justify-between py-2 text-sm">
          <button onClick={() => open(a.storage_path)} className="truncate text-left underline-offset-4 hover:underline">{a.filename}</button>
          <button onClick={() => remove(a.id, a.storage_path)} className="text-muted-foreground hover:text-destructive ml-3">
            <Trash2 className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function TraceSection({ artwork }: { artwork: any }) {
  const [transferOpen, setTransferOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const doTransfer = useServerFn(transferArtwork);
  const qc = useQueryClient();

  const traceUrl = typeof window !== "undefined" ? `${window.location.origin}/trace/${artwork.nfc_id}` : `/trace/${artwork.nfc_id}`;

  const downloadCert = async () => {
    setBusy(true);
    try {
      const blob = await generateCertificatePdf({
        title: artwork.title,
        artist: artwork.artist,
        nfcId: artwork.nfc_id,
        koaSystem: artwork.koa_system,
        installDate: artwork.install_date,
        baseUrl: typeof window !== "undefined" ? window.location.origin : "",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `certificat-${artwork.nfc_id}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } finally { setBusy(false); }
  };

  const submitTransfer = async () => {
    if (!email) return;
    setBusy(true);
    try {
      await doTransfer({ data: { artwork_id: artwork.id, new_owner_email: email, note: note || undefined } });
      toast.success("Propriété transférée");
      setTransferOpen(false); setEmail(""); setNote("");
      qc.invalidateQueries({ queryKey: ["artwork", artwork.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Échec du transfert");
    } finally { setBusy(false); }
  };

  return (
    <section className="mt-10">
      <h2 className="serif text-xl flex items-center gap-2"><ShieldCheck className="size-4" /> KOA Trace</h2>
      <p className="text-xs text-muted-foreground mt-1">Carte d'identité phygitale vérifiable.</p>
      <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
        <Meta label="ID NFC" value={<span className="mono text-xs">{artwork.nfc_id}</span>} />
        <Meta label="URL publique" value={<a href={`/trace/${artwork.nfc_id}`} target="_blank" rel="noreferrer" className="underline text-xs break-all">{traceUrl}</a>} />
      </dl>
      <div className="mt-4 flex gap-2">
        <Button onClick={downloadCert} disabled={busy} variant="outline" className="rounded-sm text-xs tracking-widest uppercase h-9">
          <Download className="size-3.5 mr-1" /> Certificat PDF
        </Button>
        <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="rounded-sm text-xs tracking-widest uppercase h-9">
              <ArrowRightLeft className="size-3.5 mr-1" /> Transférer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="serif text-2xl font-normal">Transfert de propriété</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Email du nouveau propriétaire</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-1 rounded-sm border-0 border-b border-border bg-transparent px-0 h-9" />
              </div>
              <div>
                <Label className="text-[10px] tracking-widest uppercase text-muted-foreground">Note (optionnel)</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1 rounded-sm border-0 border-b border-border bg-transparent px-0" />
              </div>
              <p className="text-[10px] text-muted-foreground">Réservé aux administrateurs et experts KOA. L'événement sera horodaté et chaîné au registre.</p>
              <Button onClick={submitTransfer} disabled={busy} className="w-full rounded-sm h-10 text-xs tracking-widest uppercase">Confirmer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </section>
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
