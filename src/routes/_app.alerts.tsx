import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/koa-helpers";

export const Route = createFileRoute("/_app/alerts")({
  head: () => ({ meta: [{ title: "Alertes — KOA Guardian" }] }),
  component: AlertsPage,
});

function AlertsPage() {
  const qc = useQueryClient();
  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*, artworks(title, id)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const active = alerts.filter((a) => !a.resolved);
  const resolved = alerts.filter((a) => a.resolved);

  const resolve = async (id: string) => {
    await supabase.from("alerts").update({ resolved: true, resolved_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["alerts-all"] });
    qc.invalidateQueries({ queryKey: ["alerts-active"] });
  };

  return (
    <main className="max-w-md mx-auto px-5 pt-10">
      <header>
        <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground">Monitoring</p>
        <h1 className="serif text-4xl mt-1">Alertes</h1>
      </header>

      <section className="mt-8">
        <h2 className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Actives ({active.length})</h2>
        {active.length === 0 ? (
          <div className="mt-4 border border-border p-6 text-center">
            <CheckCircle2 className="size-6 mx-auto text-ok" strokeWidth={1.2} />
            <p className="mt-3 text-sm text-muted-foreground">Tout est stable.</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {active.map((a) => (
              <li key={a.id} className={`bg-card border-l-2 p-4 ${a.severity === "critical" ? "border-destructive" : "border-vigilance"}`}>
                <div className="flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span>{a.kind} · {a.severity}</span>
                  <span className="mono">{formatDateTime(a.created_at)}</span>
                </div>
                <p className="text-sm mt-2">{a.message}</p>
                <div className="flex items-center justify-between mt-3">
                  <Link to="/artworks/$id" params={{ id: a.artwork_id }} className="text-xs underline underline-offset-4">
                    {a.artworks?.title ?? "Œuvre"}
                  </Link>
                  <button onClick={() => resolve(a.id)} className="text-[10px] uppercase tracking-widest text-accent">
                    Résoudre
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {resolved.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Historique</h2>
          <ul className="mt-3 space-y-2">
            {resolved.slice(0, 20).map((a) => (
              <li key={a.id} className="flex items-start gap-3 text-sm border-b border-border pb-2">
                <Bell className="size-3.5 mt-0.5 text-muted-foreground" strokeWidth={1.2} />
                <div className="flex-1 min-w-0">
                  <p className="truncate">{a.message}</p>
                  <p className="text-[10px] mono text-muted-foreground mt-0.5">
                    {a.artworks?.title} · résolu {formatDateTime(a.resolved_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
