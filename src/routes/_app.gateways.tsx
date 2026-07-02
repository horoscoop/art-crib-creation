import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronLeft, Plus, Trash2, Radio, Eye, EyeOff, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin } from "@/lib/use-is-admin";
import { listGateways, upsertGateway, deleteGateway, regenerateGatewayToken } from "@/lib/gateways.functions";

export const Route = createFileRoute("/_app/gateways")({
  head: () => ({ meta: [{ title: "Passerelles capteurs — KOA Guardian" }] }),
  component: GatewaysPage,
});

function GatewaysPage() {
  const isAdmin = useIsAdmin();
  const list = useServerFn(listGateways);
  const save = useServerFn(upsertGateway);
  const del = useServerFn(deleteGateway);
  const regenerate = useServerFn(regenerateGatewayToken);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);

  const { data: gateways = [] } = useQuery({ queryKey: ["gateways"], queryFn: () => list() });

  const refresh = () => qc.invalidateQueries({ queryKey: ["gateways"] });

  return (
    <main className="max-w-3xl mx-auto px-5 pt-8 pb-12">
      <Link to="/" className="inline-flex items-center gap-1 text-xs tracking-widest uppercase text-muted-foreground">
        <ChevronLeft className="size-4" /> Application
      </Link>
      <header className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground">{isAdmin ? "Admin" : "Mon compte"}</p>
          <h1 className="serif text-3xl mt-1">Passerelles capteurs</h1>
        </div>
        <button onClick={() => setEditing({ name: "", protocol: "webhook", endpoint: "", payload_mapping: {}, sync_interval_s: 300 })}
          className="inline-flex items-center gap-1.5 text-xs tracking-widest uppercase text-accent">
          <Plus className="size-3.5" /> Nouvelle
        </button>
      </header>

      <p className="mt-4 text-sm text-muted-foreground">
        Configurez ici les flux entrants de vos capteurs (HTTP, webhook ou MQTT). Chaque passerelle reçoit un jeton unique et applique un mapping pour normaliser le format des données.
      </p>

      <ul className="mt-6 space-y-3">
        {gateways.length === 0 && (
          <li className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Aucune passerelle. Créez-en une pour synchroniser vos capteurs.
          </li>
        )}
        {gateways.map((g: any) => (
          <GatewayCard
            key={g.id}
            gateway={g}
            onEdit={() => setEditing(g)}
            onDelete={async () => {
              if (!confirm("Supprimer ?")) return;
              await del({ data: { id: g.id } });
              refresh();
            }}
            onRegenerate={async () => {
              if (!confirm("Régénérer le jeton ? L'ancien jeton cessera immédiatement de fonctionner — pensez à mettre à jour vos capteurs.")) return;
              await regenerate({ data: { id: g.id } });
              toast.success("Jeton régénéré");
              refresh();
            }}
          />
        ))}
      </ul>

      {editing && (
        <EditDialog
          gateway={editing}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            await save({ data: v });
            toast.success("Passerelle enregistrée");
            setEditing(null);
            refresh();
          }}
        />
      )}
    </main>
  );
}

function GatewayCard({ gateway: g, onEdit, onDelete, onRegenerate }: {
  gateway: any;
  onEdit: () => void;
  onDelete: () => void;
  onRegenerate: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const masked = "•".repeat(8) + g.auth_token.slice(-4);
  const shown = revealed ? g.auth_token : masked;

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(g.auth_token);
      toast.success("Jeton copié");
    } catch {
      toast.error("Impossible de copier automatiquement — sélectionnez le texte manuellement");
    }
  };

  return (
    <li className="border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="size-3.5 text-muted-foreground" />
            <h3 className="serif text-lg">{g.name}</h3>
            <span className="text-[10px] uppercase tracking-widest px-2 border border-border text-muted-foreground">{g.protocol}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 mono break-all">{g.endpoint || "—"}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onEdit} className="text-[10px] uppercase tracking-widest underline">Modifier</button>
          <button onClick={onDelete} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-border text-xs grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Jeton</p>
          <div className="flex items-center gap-2 mt-0.5">
            <code className="mono text-[10px] break-all">{shown}</code>
            <button onClick={() => setRevealed((r) => !r)} className="text-muted-foreground hover:text-foreground shrink-0" title={revealed ? "Masquer" : "Afficher"}>
              {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
            <button onClick={copyToken} className="text-muted-foreground hover:text-foreground shrink-0" title="Copier">
              <Copy className="size-3.5" />
            </button>
            <button onClick={onRegenerate} className="text-muted-foreground hover:text-destructive shrink-0" title="Régénérer">
              <RefreshCw className="size-3.5" />
            </button>
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Intervalle de sync</p>
          <p className="mono">{g.sync_interval_s}s</p>
        </div>
      </div>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-muted-foreground">Endpoint d'ingestion</summary>
        <code className="mono text-[10px] break-all block mt-2 p-2 bg-secondary">
          POST /api/public/sensors/ingest{"\n"}
          Headers: X-Gateway-Token: {shown}{"\n"}
          Body: {`{"artwork_id":"<uuid>", ...vos champs (mapping appliqué)}`}
        </code>
      </details>
    </li>
  );
}

function EditDialog({ gateway, onClose, onSave }: { gateway: any; onClose: () => void; onSave: (v: any) => void }) {
  const [f, setF] = useState({
    id: gateway.id,
    name: gateway.name || "",
    protocol: gateway.protocol || "webhook",
    endpoint: gateway.endpoint || "",
    sync_interval_s: gateway.sync_interval_s || 300,
    mappingText: JSON.stringify(gateway.payload_mapping || {}, null, 2),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-background border border-border w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="serif text-2xl">Passerelle</h2>
        <div className="mt-4 space-y-3 text-sm">
          <Field label="Nom"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="w-full border-b border-border bg-transparent h-9" /></Field>
          <Field label="Protocole">
            <select value={f.protocol} onChange={(e) => setF({ ...f, protocol: e.target.value })} className="w-full border-b border-border bg-transparent h-9">
              <option value="webhook">Webhook (push)</option>
              <option value="http">HTTP (pull)</option>
              <option value="mqtt">MQTT</option>
            </select>
          </Field>
          <Field label="Endpoint distant (optionnel pour webhook)">
            <input value={f.endpoint} onChange={(e) => setF({ ...f, endpoint: e.target.value })} className="w-full border-b border-border bg-transparent h-9 mono text-xs" placeholder="https://broker.example/topic" />
          </Field>
          <Field label="Intervalle de synchronisation (s)">
            <input type="number" value={f.sync_interval_s} onChange={(e) => setF({ ...f, sync_interval_s: Number(e.target.value) })} className="w-full border-b border-border bg-transparent h-9 mono" />
          </Field>
          <Field label="Mapping JSON (champ source → champ KOA)">
            <textarea rows={6} value={f.mappingText} onChange={(e) => setF({ ...f, mappingText: e.target.value })}
              className="w-full border border-border bg-transparent p-2 mono text-xs" />
            <p className="text-[10px] text-muted-foreground mt-1">Ex: <code className="mono">{`{ "hum": "humidity_pct", "temp_c": "temperature_c" }`}</code></p>
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="text-xs uppercase tracking-widest text-muted-foreground">Annuler</button>
          <button onClick={() => {
            let mapping = {};
            try { mapping = JSON.parse(f.mappingText || "{}"); } catch { return toast.error("Mapping JSON invalide"); }
            onSave({
              id: f.id, name: f.name, protocol: f.protocol, endpoint: f.endpoint || null,
              payload_mapping: mapping, sync_interval_s: f.sync_interval_s,
            });
          }} className="text-xs uppercase tracking-widest underline">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
