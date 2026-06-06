import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Radio, Clock, ShieldCheck, Activity, ChevronRight } from "lucide-react";
import { useRoles } from "@/lib/use-roles";
import { getSupervisionDashboard } from "@/lib/dashboard.functions";
import { formatDateTime } from "@/lib/koa-helpers";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Supervision — KOA Guardian" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { isAdminOrExpert } = useRoles();
  const navigate = useNavigate();
  const load = useServerFn(getSupervisionDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["supervision-dashboard"],
    queryFn: () => load(),
    enabled: isAdminOrExpert,
    refetchInterval: 30_000,
  });

  if (!isAdminOrExpert) {
    return (
      <main className="max-w-md mx-auto px-5 pt-12 text-center">
        <p className="text-xs tracking-widest uppercase text-muted-foreground">Accès restreint</p>
        <h1 className="serif text-2xl mt-2">Supervision</h1>
        <p className="text-sm text-muted-foreground mt-4">
          Réservé aux administrateurs et experts KOA.
        </p>
        <button onClick={() => navigate({ to: "/" })} className="mt-6 text-xs tracking-widest uppercase underline">
          Retour au parc
        </button>
      </main>
    );
  }

  if (isLoading || !data) {
    return <div className="p-12 text-center text-xs tracking-widest uppercase text-muted-foreground">Chargement…</div>;
  }

  const c = data.counts;

  return (
    <main className="max-w-4xl mx-auto px-5 pt-8 pb-12">
      <header>
        <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground">Tableau de bord</p>
        <h1 className="serif text-3xl mt-1">Supervision globale</h1>
      </header>

      <section className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border">
        <Stat label="Œuvres" value={c.artworks} />
        <Stat label="Critiques" value={c.criticalAlerts} tone={c.criticalAlerts > 0 ? "critical" : undefined} />
        <Stat label="Vigilance" value={c.vigilanceAlerts} tone={c.vigilanceAlerts > 0 ? "vigilance" : undefined} />
        <Stat label="Critère criticité" value={c.critique} />
        <Stat label="Capteurs en ligne" value={`${c.gatewaysOnline}/${c.gatewaysTotal}`} />
        <Stat label="Inspections en retard" value={c.overdueInspections} tone={c.overdueInspections > 0 ? "vigilance" : undefined} />
        <Stat label="Œuvres silencieuses 7j" value={data.silentArtworks.length} tone={data.silentArtworks.length > 0 ? "vigilance" : undefined} />
        <Stat label="Événements 24h" value={data.recentEvents.length} />
      </section>

      <div className="mt-10 grid md:grid-cols-2 gap-8">
        <Panel title="Alertes actives" icon={AlertTriangle}>
          {data.recentAlerts.length === 0 ? (
            <Empty>Aucune alerte active.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {data.recentAlerts.map((a) => (
                <li key={a.id}>
                  <Link to="/artworks/$id" params={{ id: a.artwork_id }} className="flex items-start gap-3 py-3 group">
                    <span className={`mt-1 size-1.5 rounded-full shrink-0 ${a.severity === "critical" ? "bg-destructive" : "bg-vigilance"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{a.artwork_title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{a.message}</p>
                      <p className="text-[10px] mono text-muted-foreground mt-1">{formatDateTime(a.created_at)}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Statut des capteurs" icon={Radio}>
          {data.gateways.length === 0 ? (
            <Empty>Aucun gateway enregistré.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {data.gateways.map((g) => (
                <li key={g.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm">{g.name}</p>
                    <p className="text-[10px] mono text-muted-foreground mt-0.5">
                      {g.last_sync_at ? `Sync ${formatDateTime(g.last_sync_at)}` : "Jamais synchronisé"}
                    </p>
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 border ${g.status === "online" ? "border-ok text-ok" : "border-destructive text-destructive"}`}>
                    {g.status ?? "inconnu"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Inspections en retard" icon={Clock}>
          {data.overdueInspections.length === 0 ? (
            <Empty>Toutes les inspections sont à jour.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {data.overdueInspections.map((i) => (
                <li key={i.id}>
                  <Link to="/artworks/$id" params={{ id: i.artwork_id }} className="flex items-center justify-between py-3 group">
                    <div>
                      <p className="text-sm">{i.artwork_title}</p>
                      <p className="text-[10px] mono text-destructive mt-0.5">
                        Échue le {i.next_due_at ? formatDateTime(i.next_due_at) : "—"}
                      </p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Derniers événements traçabilité" icon={Activity}>
          {data.recentEvents.length === 0 ? (
            <Empty>Aucun événement enregistré.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {data.recentEvents.slice(0, 8).map((e) => (
                <li key={e.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{e.artwork_title}</p>
                    <p className="text-[10px] mono text-muted-foreground">{e.event_type}</p>
                  </div>
                  <p className="text-[10px] mono text-muted-foreground shrink-0">{formatDateTime(e.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {data.silentArtworks.length > 0 && (
          <Panel title="Œuvres sans relevé (>7j)" icon={ShieldCheck}>
            <ul className="divide-y divide-border">
              {data.silentArtworks.map((w) => (
                <li key={w.id}>
                  <Link to="/artworks/$id" params={{ id: w.id }} className="flex items-center justify-between py-3 group">
                    <div>
                      <p className="text-sm">{w.title}</p>
                      <p className="text-[10px] mono text-muted-foreground mt-0.5">
                        {[w.site, w.room, w.location].filter(Boolean).join(" · ") || "Lieu non renseigné"}
                      </p>
                    </div>
                    <span className="text-[10px] mono text-muted-foreground">
                      {w.last_seen ? formatDateTime(w.last_seen) : "Jamais"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "vigilance" | "critical" }) {
  return (
    <div className="bg-card p-4 text-center">
      <div className={`serif text-3xl ${tone === "critical" ? "text-destructive" : tone === "vigilance" ? "text-vigilance" : ""}`}>
        {value}
      </div>
      <div className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section>
      <header className="flex items-center gap-2 mb-2">
        <Icon className="size-4 text-muted-foreground" strokeWidth={1.5} />
        <h2 className="serif text-lg">{title}</h2>
      </header>
      <div className="border border-border bg-card px-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-xs text-muted-foreground">{children}</p>;
}
