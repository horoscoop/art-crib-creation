import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronLeft, Users, LayoutGrid, Activity, Radio, Download, Database } from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin } from "@/lib/use-is-admin";
import {
  listUsersAdmin,
  setUserRoleAdmin,
  listAllArtworksAdmin,
  updateArtworkThresholdsAdmin,
  listConnectionLogsAdmin,
  clearConnectionLogsAdmin,
  listOwnersAdmin,
  ASSIGNABLE_ROLES,
} from "@/lib/admin.functions";
import { exportClientReport } from "@/lib/exports.functions";
import { createBackup, listBackups, downloadBackup, deleteBackup } from "@/lib/backups.functions";
import { formatDateTime } from "@/lib/koa-helpers";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  expert_koa: "Expert KOA",
  conservateur: "Conservateur",
  musee: "Musée",
  galerie: "Galerie",
  technicien: "Technicien",
};

export const Route = createFileRoute("/_app/admin")({
  head: () => ({ meta: [{ title: "Console admin — KOA Guardian" }] }),
  component: AdminConsole,
});

type Tab = "users" | "fleet" | "logs" | "exports" | "backups";

function AdminConsole() {
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("users");

  if (!isAdmin) {
    return (
      <main className="max-w-md mx-auto px-5 pt-12 text-center">
        <p className="text-xs tracking-widest uppercase text-muted-foreground">Accès réservé</p>
        <h1 className="serif text-2xl mt-2">Console administrateur</h1>
        <p className="text-sm text-muted-foreground mt-4">Ce profil n'a pas les droits administrateur.</p>
        <button onClick={() => navigate({ to: "/" })} className="mt-6 text-xs tracking-widest uppercase underline">Retour</button>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-5 pt-8 pb-12">
      <Link to="/" className="inline-flex items-center gap-1 text-xs tracking-widest uppercase text-muted-foreground">
        <ChevronLeft className="size-4" /> Application
      </Link>
      <header className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground">Console</p>
          <h1 className="serif text-3xl mt-1">Administration</h1>
        </div>
      </header>

      <nav className="mt-6 flex gap-1 border-b border-border overflow-x-auto">
        {[
          { id: "users", label: "Utilisateurs", icon: Users },
          { id: "fleet", label: "Parc global", icon: LayoutGrid },
          { id: "logs", label: "Connexions", icon: Activity },
          { id: "exports", label: "Exports", icon: Download },
          { id: "backups", label: "Sauvegardes", icon: Database },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id as Tab)}
            className={`flex items-center gap-2 px-4 py-2.5 text-[11px] tracking-widest uppercase border-b-2 -mb-px ${tab === id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </nav>

      <div className="mt-8">
        {tab === "users" && <UsersTab />}
        {tab === "fleet" && <FleetTab />}
        {tab === "logs" && <LogsTab />}
        {tab === "exports" && <ExportsTab />}
        {tab === "backups" && <BackupsTab />}
      </div>
    </main>
  );
}

function UsersTab() {
  const list = useServerFn(listUsersAdmin);
  const setRole = useServerFn(setUserRoleAdmin);
  const qc = useQueryClient();
  const { data: users = [] } = useQuery({ queryKey: ["admin-users"], queryFn: () => list() });

  const toggle = async (userId: string, isAdminRole: boolean) => {
    await setRole({ data: { userId, role: "admin", grant: !isAdminRole } });
    toast.success(isAdminRole ? "Admin retiré" : "Admin accordé");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
          <tr><th className="text-left py-3">Email</th><th className="text-left">Organisation</th><th className="text-left">Rôles</th><th></th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((u) => {
            const isAdminRole = u.roles.includes("admin");
            return (
              <tr key={u.id}>
                <td className="py-3 mono text-xs">{u.email}</td>
                <td>{u.organization ?? "—"}</td>
                <td>
                  {u.roles.map((r) => (
                    <span key={r} className={`inline-block text-[10px] uppercase tracking-widest px-2 py-0.5 mr-1 border ${r === "admin" ? "border-foreground" : "border-border text-muted-foreground"}`}>{r}</span>
                  ))}
                </td>
                <td className="text-right">
                  <button onClick={() => toggle(u.id, isAdminRole)} className="text-[10px] uppercase tracking-widest underline">
                    {isAdminRole ? "Retirer admin" : "Promouvoir admin"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FleetTab() {
  const list = useServerFn(listAllArtworksAdmin);
  const upd = useServerFn(updateArtworkThresholdsAdmin);
  const qc = useQueryClient();
  const { data: works = [] } = useQuery({ queryKey: ["admin-fleet"], queryFn: () => list() });

  const save = async (id: string, vals: { max_humidity: number; max_tilt_deg: number; max_drift_mm: number }) => {
    await upd({ data: { id, ...vals } });
    toast.success("Seuils mis à jour");
    qc.invalidateQueries({ queryKey: ["admin-fleet"] });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
          <tr>
            <th className="text-left py-3">Œuvre</th><th className="text-left">Client</th>
            <th className="text-right">Humidité max</th><th className="text-right">Inclinaison max</th><th className="text-right">Fluage max</th><th></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {works.map((w) => <FleetRow key={w.id} w={w} onSave={save} />)}
        </tbody>
      </table>
    </div>
  );
}

function FleetRow({ w, onSave }: { w: any; onSave: (id: string, v: any) => void }) {
  const [h, setH] = useState(w.max_humidity);
  const [t, setT] = useState(w.max_tilt_deg);
  const [d, setD] = useState(w.max_drift_mm);
  return (
    <tr>
      <td className="py-3">
        <Link to="/artworks/$id" params={{ id: w.id }} className="serif underline-offset-4 hover:underline">{w.title}</Link>
        <p className="text-[10px] text-muted-foreground">{w.location ?? "—"}</p>
      </td>
      <td className="mono text-xs">{w.owner_email}</td>
      <td className="text-right"><input type="number" step="1" value={h} onChange={(e) => setH(Number(e.target.value))} className="w-16 text-right bg-transparent border-b border-border" /> %</td>
      <td className="text-right"><input type="number" step="0.1" value={t} onChange={(e) => setT(Number(e.target.value))} className="w-16 text-right bg-transparent border-b border-border" /> °</td>
      <td className="text-right"><input type="number" step="0.1" value={d} onChange={(e) => setD(Number(e.target.value))} className="w-16 text-right bg-transparent border-b border-border" /> mm</td>
      <td className="text-right">
        <button onClick={() => onSave(w.id, { max_humidity: h, max_tilt_deg: t, max_drift_mm: d })} className="text-[10px] uppercase tracking-widest underline">Enregistrer</button>
      </td>
    </tr>
  );
}

function LogsTab() {
  const list = useServerFn(listConnectionLogsAdmin);
  const clear = useServerFn(clearConnectionLogsAdmin);
  const qc = useQueryClient();
  const { data: logs = [] } = useQuery({ queryKey: ["admin-logs"], queryFn: () => list() });
  const reset = async () => {
    if (!confirm("Effacer définitivement l'historique des connexions ?")) return;
    try {
      await clear();
      toast.success("Historique de connexion effacé");
      qc.invalidateQueries({ queryKey: ["admin-logs"] });
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">{logs.length} entrée{logs.length > 1 ? "s" : ""}</p>
        <button onClick={reset} disabled={logs.length === 0}
          className="text-[11px] uppercase tracking-widest border border-border px-3 py-1.5 hover:border-destructive hover:text-destructive disabled:opacity-40">
          Remise à zéro
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
            <tr><th className="text-left py-3">Date</th><th className="text-left">Email</th><th className="text-left">Événement</th><th className="text-left">Agent</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map((l: any) => (
              <tr key={l.id}>
                <td className="py-2 mono text-xs">{new Date(l.created_at).toLocaleString("fr-FR")}</td>
                <td className="mono text-xs">{l.email ?? "—"}</td>
                <td><span className="text-[10px] uppercase tracking-widest border border-border px-2 py-0.5">{l.event}</span></td>
                <td className="text-xs text-muted-foreground truncate max-w-[260px]">{l.user_agent ?? "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">Aucune connexion enregistrée.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExportsTab() {
  const owners = useServerFn(listOwnersAdmin);
  const exportFn = useServerFn(exportClientReport);
  const { data: list = [] } = useQuery({ queryKey: ["admin-owners"], queryFn: () => owners() });
  const [busy, setBusy] = useState<string | null>(null);

  const dl = async (ownerId: string, format: "pdf" | "xlsx") => {
    setBusy(ownerId + format);
    try {
      const res = await exportFn({ data: { ownerId, format } });
      const blob = new Blob([Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0))], { type: res.mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = res.filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
          <tr><th className="text-left py-3">Client</th><th className="text-right">Exporter</th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {list.map((o: any) => (
            <tr key={o.id}>
              <td className="py-3 mono text-xs">{o.email}</td>
              <td className="text-right space-x-3">
                <button disabled={busy === o.id + "pdf"} onClick={() => dl(o.id, "pdf")} className="text-[10px] uppercase tracking-widest underline disabled:opacity-50">PDF</button>
                <button disabled={busy === o.id + "xlsx"} onClick={() => dl(o.id, "xlsx")} className="text-[10px] uppercase tracking-widest underline disabled:opacity-50">Excel</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BackupsTab() {
  const create = useServerFn(createBackup);
  const list = useServerFn(listBackups);
  const dl = useServerFn(downloadBackup);
  const del = useServerFn(deleteBackup);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data: rows = [] } = useQuery({ queryKey: ["backups"], queryFn: () => list() });

  const run = async () => {
    setBusy(true);
    try { await create(); toast.success("Sauvegarde créée"); qc.invalidateQueries({ queryKey: ["backups"] }); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const download = async (id: string) => {
    try { const { url } = await dl({ data: { id } }); window.open(url, "_blank"); }
    catch (e: any) { toast.error(e.message); }
  };
  const remove = async (id: string) => {
    if (!confirm("Supprimer cette sauvegarde ?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["backups"] });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">Export JSON complet des tables métier. À télécharger et archiver localement.</p>
        <button disabled={busy} onClick={run} className="text-[11px] uppercase tracking-widest border border-foreground px-3 py-1.5 disabled:opacity-50">
          {busy ? "En cours…" : "Sauvegarder"}
        </button>
      </div>
      <table className="w-full text-sm">
        <thead className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
          <tr><th className="text-left py-3">Date</th><th className="text-right">Taille</th><th className="text-right">Lignes</th><th></th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((b: any) => (
            <tr key={b.id}>
              <td className="py-2 mono text-xs">{formatDateTime(b.created_at)}</td>
              <td className="text-right mono text-xs">{((b.size_bytes ?? 0) / 1024).toFixed(1)} kB</td>
              <td className="text-right mono text-xs">{b.rows_count ?? "—"}</td>
              <td className="text-right space-x-3">
                <button onClick={() => download(b.id)} className="text-[10px] uppercase tracking-widest underline">Télécharger</button>
                <button onClick={() => remove(b.id)} className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-destructive">Supprimer</button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">Aucune sauvegarde.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
