import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { getTracePassport } from "@/lib/trace.functions";
import { formatDateTime } from "@/lib/koa-helpers";

export const Route = createFileRoute("/trace/$nfcId")({
  head: ({ params }) => ({
    meta: [
      { title: `Carte d'identité — ${params.nfcId} — KOA Trace` },
      { name: "description", content: "Carte d'identité technique vérifiable d'une œuvre suivie par KOA Guardian." },
    ],
  }),
  component: TracePage,
});

type Passport = {
  nfc_id: string;
  title: string;
  artist: string | null;
  install_date: string | null;
  koa_system: string | null;
  location: string | null;
  events: Array<{
    seq: number;
    event_type: string;
    created_at: string;
    hash: string;
    prev_hash: string | null;
    payload: Record<string, unknown>;
  }>;
  chain_ok: boolean;
} | null;

function TracePage() {
  const { nfcId } = Route.useParams();
  const fetchPassport = useServerFn(getTracePassport);
  const { data, isLoading } = useQuery({
    queryKey: ["trace", nfcId],
    queryFn: () => fetchPassport({ data: { nfc_id: nfcId } }) as Promise<Passport>,
  });

  if (isLoading) return <main className="p-8 text-center text-xs text-muted-foreground">Vérification du registre…</main>;
  if (!data) return (
    <main className="max-w-md mx-auto px-5 pt-12 text-center">
      <h1 className="serif text-3xl">Non trouvée</h1>
      <p className="text-sm text-muted-foreground mt-2">Aucune œuvre n'est associée à cet identifiant NFC.</p>
    </main>
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name: data.title,
    creator: data.artist ?? undefined,
    locationCreated: data.location ?? undefined,
    dateCreated: data.install_date ?? undefined,
    identifier: data.nfc_id,
  };

  return (
    <main className="max-w-md mx-auto px-5 pt-8 pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground">KOA Trace · Carte d'identité</p>
      <h1 className="serif text-3xl mt-2">{data.title}</h1>
      {data.artist && <p className="text-sm text-muted-foreground mt-1">{data.artist}</p>}

      <div className={`mt-5 inline-flex items-center gap-2 text-xs px-2 py-1 border ${data.chain_ok ? "border-green-600 text-green-700" : "border-destructive text-destructive"}`}>
        {data.chain_ok ? <ShieldCheck className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
        {data.chain_ok ? "Registre vérifié" : "Chaîne corrompue"}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-y-3 text-sm border-t border-border pt-4">
        <Meta label="Identifiant NFC" value={<span className="mono text-xs">{data.nfc_id}</span>} />
        <Meta label="Système KOA" value={data.koa_system ?? "—"} />
        <Meta label="Emplacement" value={data.location ?? "—"} />
        <Meta label="Posée le" value={data.install_date ?? "—"} />
      </dl>

      <section className="mt-10">
        <h2 className="serif text-xl">Registre append-only</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Chaque évènement est lié au précédent par un hash SHA-256. La chaîne est vérifiable publiquement.
        </p>

        <ol className="mt-5 space-y-4">
          {data.events.length === 0 && <p className="text-sm text-muted-foreground">Aucun évènement enregistré.</p>}
          {data.events.map((e) => (
            <li key={e.seq} className="border-l-2 border-border pl-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">#{e.seq} · {e.event_type}</span>
                <span className="text-[10px] mono text-muted-foreground">{formatDateTime(e.created_at)}</span>
              </div>
              <p className="mono text-[10px] mt-2 break-all text-muted-foreground">
                hash: {e.hash.slice(0, 16)}…{e.hash.slice(-8)}
              </p>
              {e.prev_hash && (
                <p className="mono text-[10px] break-all text-muted-foreground">
                  prev: {e.prev_hash.slice(0, 16)}…{e.prev_hash.slice(-8)}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-12 pt-6 border-t border-border text-[10px] tracking-[0.3em] uppercase text-muted-foreground text-center">
        Vérifié par KOA Guardian
      </footer>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
