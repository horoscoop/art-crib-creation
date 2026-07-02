import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ChevronLeft, Users, LayoutGrid, Activity, Radio, Download, Database,
  Award, Eye, MessageCircle, Check, X, Trash2, ClipboardList, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin } from "@/lib/use-is-admin";
import {
  listUsersAdmin,
  setUserRoleAdmin,
  setUserApprovedAdmin,
  deleteUserAdmin,
  listAllArtworksAdmin,
  updateArtworkThresholdsAdmin,
  listConnectionLogsAdmin,
  clearConnectionLogsAdmin,
  listOwnersAdmin,
  listExpertisesAdmin,
  deleteExpertiseAdmin,
  listVisionDiagnosticsAdmin,
  getVisionDiagnosticAdmin,
  deleteVisionDiagnosticAdmin,
  cimaiseStatsAdmin,
  listCimaiseMessagesAdmin,
  deleteCimaiseUserHistoryAdmin,
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

type Tab = "users" | "fleet" | "logs" | "expertises" | "vision" | "cimaise" | "exports" | "backups";

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

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "users", label: "Utilisateurs", icon: Users },
    { id: "fleet", label: "Parc global", icon: LayoutGrid },
    { id: "logs", label: "Connexions", icon: Activity },
    { id: "expertises", label: "Expertises", icon: Award },
    { id: "vision", label: "KOA Vision", icon: Eye },
    { id: "cimaise", label: "Cimaise", icon: MessageCircle },
    { id: "exports", label: "Exports", icon: Download },
    { id: "backups", label: "Sauvegardes", icon: Database },
  ];

  return (
    <main className="max-w-5xl mx-auto px-5 pt-8 pb-12">
      <Link to="/" className="inline-flex items-center gap-1 text-xs tracking-widest uppercase text-muted-foreground">
        <ChevronLeft className="size-4" /> Application
      </Link>
      <header className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground">Console</p>
          <h1 className="serif text-3xl mt-1">Administration</h1>
        </div>
        <Link to="/compliance" className="text-[11px] uppercase tracking-widest border border-border px-3 py-1.5 hover:border-foreground inline-flex items-center gap-1.5">
          <FileText className="size-3.5" /> Rapport conformité
        </Link>
      </header>

      <nav className="mt-6 flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-[11px] tracking-widest uppercase border-b-2 -mb-px whitespace-nowrap ${tab === id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </nav>

      <div className="mt-8">
        {tab === "users" && <UsersTab />}
        {tab === "fleet" && <FleetTab />}
        {tab === "logs" && <LogsTab />}
        {tab === "expertises" && <ExpertisesTab />}
        {tab === "vision" && <VisionTab />}
        {tab === "cimaise" && <CimaiseTab />}
        {tab === "exports" && <ExportsTab />}
        {tab === "backups" && <BackupsTab />}
      </div>
    </main>
  );
}

function UsersTab() {
  const list = useServerFn(listUsersAdmin);
  const setRole = useServerFn(setUserRoleAdmin);
  const setApproved = useServerFn(setUserApprovedAdmin);
  const delUser = useServerFn(deleteUserAdmin);
  const qc = useQueryClient();
  const { data: users = [] } = useQuery({ queryKey: ["admin-users"], queryFn: () => list() });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const toggle = async (userId: string, role: typeof ASSIGNABLE_ROLES[number], grant: boolean) => {
    try {
      await setRole({ data: { userId, role, grant } });
      toast.success(grant ? `Rôle ${ROLE_LABELS[role]} accordé` : `Rôle ${ROLE_LABELS[role]} retiré`);
      invalidate();
    } catch (e: any) { toast.error(e.message ?? "Erreur"); }
  };

  const approve = async (userId: string, approved: boolean) => {
    try {
      await setApproved({ data: { userId, approved } });
      toast.success(approved ? "Profil validé" : "Validation retirée");
      invalidate();
    } catch (e: any) { toast.error(e.message); }
  };

  const remove = async (u: any) => {
    if (!confirm(`Supprimer définitivement le compte ${u.email} ?\n\nCette action supprime aussi ses œuvres, historiques et accès associés.`)) return;
    try {
      await delUser({ data: { userId: u.id } });
      toast.success("Compte supprimé");
      invalidate();
    } catch (e: any) { toast.error(e.message); }
  };

  const pending = users.filter((u: any) => !u.approved);

  return (
    <div className="space-y-8">
      {pending.length > 0 && (
        <section className="border border-amber-500/50 bg-amber-500/5 rounded-sm p-4">
          <h3 className="text-[10px] uppercase tracking-widest text-amber-600 dark:text-amber-500 mb-3">
            {pending.length} profil{pending.length > 1 ? "s" : ""} en attente de validation
          </h3>
          <ul className="divide-y divide-border">
            {pending.map((u: any) => (
              <li key={u.id} className="py-2 flex items-center justify-between gap-3">
                <div>
                  <p className="mono text-xs">{u.email}</p>
                  <p className="text-[10px] text-muted-foreground">{u.organization ?? "—"} · inscrit le {formatDateTime(u.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => approve(u.id, true)} className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest border border-foreground px-2.5 py-1 hover:bg-foreground hover:text-background">
                    <Check className="size-3" /> Valider
                  </button>
                  <button onClick={() => remove(u)} className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-destructive px-2.5 py-1">
                    <X className="size-3" /> Refuser
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div>
        <p className="text-xs text-muted-foreground mb-4">
          Coche les rôles à attribuer. La colonne « Statut » permet de valider ou révoquer un profil. Utilise la corbeille pour supprimer un compte.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-3">Email</th>
                <th className="text-left">Organisation</th>
                <th className="text-center">Statut</th>
                {ASSIGNABLE_ROLES.map((r) => (
                  <th key={r} className="text-center px-1">{ROLE_LABELS[r]}</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u: any) => (
                <tr key={u.id}>
                  <td className="py-3 mono text-xs">
                    {u.email}
                    {u.last_sign_in_at && (
                      <p className="text-[10px] text-muted-foreground normal-case">Dernière connexion : {formatDateTime(u.last_sign_in_at)}</p>
                    )}
                  </td>
                  <td className="text-xs">{u.organization ?? "—"}</td>
                  <td className="text-center">
                    <button
                      onClick={() => approve(u.id, !u.approved)}
                      className={`text-[10px] uppercase tracking-widest px-2 py-0.5 border ${u.approved ? "border-emerald-500/60 text-emerald-600" : "border-amber-500/60 text-amber-600"}`}>
                      {u.approved ? "Validé" : "En attente"}
                    </button>
                  </td>
                  {ASSIGNABLE_ROLES.map((r) => {
                    const has = u.roles.includes(r);
                    return (
                      <td key={r} className="text-center px-1">
                        <input
                          type="checkbox"
                          checked={has}
                          onChange={() => toggle(u.id, r, !has)}
                          className="size-4 accent-foreground cursor-pointer"
                        />
                      </td>
                    );
                  })}
                  <td className="text-right pr-1">
                    <button onClick={() => remove(u)} title="Supprimer le compte" className="text-muted-foreground hover:text-destructive p-1">
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
          {works.map((w: any) => <FleetRow key={w.id} w={w} onSave={save} />)}
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
  const { data: logs = [] } = useQuery({ queryKey: ["admin-logs"], queryFn: () => list(), refetchOnWindowFocus: true });
  const reset = async () => {
    if (!confirm("Effacer définitivement l'historique des connexions ?")) return;
    try {
      await clear();
      toast.success("Historique effacé");
      qc.invalidateQueries({ queryKey: ["admin-logs"] });
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">
          {logs.length} entrée{logs.length > 1 ? "s" : ""} · enregistrées à chaque connexion utilisateur.
        </p>
        <div className="flex gap-2">
          <button onClick={() => qc.invalidateQueries({ queryKey: ["admin-logs"] })} className="text-[11px] uppercase tracking-widest border border-border px-3 py-1.5 hover:border-foreground">
            Rafraîchir
          </button>
          <button onClick={reset} disabled={logs.length === 0}
            className="text-[11px] uppercase tracking-widest border border-border px-3 py-1.5 hover:border-destructive hover:text-destructive disabled:opacity-40">
            Remise à zéro
          </button>
        </div>
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
            {logs.length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                Aucune connexion enregistrée. Les nouvelles connexions apparaîtront ici automatiquement.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExpertisesTab() {
  const list = useServerFn(listExpertisesAdmin);
  const del = useServerFn(deleteExpertiseAdmin);
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({ queryKey: ["admin-expertises"], queryFn: () => list() });
  const [open, setOpen] = useState<string | null>(null);

  const remove = async (id: string) => {
    if (!confirm("Supprimer définitivement cette expertise ?")) return;
    try { await del({ data: { id } }); toast.success("Expertise supprimée"); qc.invalidateQueries({ queryKey: ["admin-expertises"] }); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-4">
        {rows.length} expertise{rows.length > 1 ? "s" : ""} archivée{rows.length > 1 ? "s" : ""}.
      </p>
      <ul className="divide-y divide-border">
        {rows.map((e: any) => (
          <li key={e.id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{e.type}</p>
                <p className="serif text-base">{e.artworks?.title ?? "—"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {formatDateTime(e.performed_at)} · Expert : <span className="mono">{e.expert_email || "—"}</span> · Client : <span className="mono">{e.owner_email || "—"}</span>
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => setOpen(open === e.id ? null : e.id)} className="text-[10px] uppercase tracking-widest underline">
                  {open === e.id ? "Fermer" : "Détail"}
                </button>
                <button onClick={() => remove(e.id)} title="Supprimer" className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
            {open === e.id && (
              <div className="mt-3 rounded-sm border border-border p-3 text-xs space-y-2">
                {e.kit_recommande && <p><span className="uppercase tracking-widest text-[10px] text-muted-foreground">Kit : </span>{e.kit_recommande}</p>}
                {e.charge_mesuree_kg != null && <p><span className="uppercase tracking-widest text-[10px] text-muted-foreground">Charge : </span>{e.charge_mesuree_kg} kg</p>}
                <p className="whitespace-pre-wrap">{e.rapport}</p>
                {e.recommandations && <p className="whitespace-pre-wrap text-muted-foreground">{e.recommandations}</p>}
              </div>
            )}
          </li>
        ))}
        {rows.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">Aucune expertise archivée.</li>}
      </ul>
    </div>
  );
}

function VisionTab() {
  const list = useServerFn(listVisionDiagnosticsAdmin);
  const get = useServerFn(getVisionDiagnosticAdmin);
  const del = useServerFn(deleteVisionDiagnosticAdmin);
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({ queryKey: ["admin-vision"], queryFn: () => list() });
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);

  const toggle = async (id: string) => {
    if (open === id) { setOpen(null); setDetail(null); return; }
    setOpen(id); setDetail(null);
    try { const row = await get({ data: { id } }); setDetail(row); }
    catch (e: any) { toast.error(e.message); }
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce diagnostic KOA Vision ?")) return;
    try { await del({ data: { id } }); toast.success("Diagnostic supprimé"); qc.invalidateQueries({ queryKey: ["admin-vision"] }); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-4">
        {rows.length} rapport{rows.length > 1 ? "s" : ""} KOA Vision archivé{rows.length > 1 ? "s" : ""}.
      </p>
      <table className="w-full text-sm">
        <thead className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
          <tr><th className="text-left py-3">Date</th><th className="text-left">Utilisateur</th><th className="text-left">Mode</th><th className="text-left">Kit</th><th className="text-right">Score</th><th></th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r: any) => (
            <>
              <tr key={r.id}>
                <td className="py-2 mono text-xs">{formatDateTime(r.created_at)}</td>
                <td className="mono text-xs">{r.user_email || "—"}</td>
                <td className="text-xs">{r.mode === "recommendation" ? "Reco" : "Diag"}</td>
                <td className="text-xs">{r.kit_recommande ?? "—"}</td>
                <td className="text-right mono text-xs">{r.scoring_securite ?? "—"}</td>
                <td className="text-right space-x-3">
                  <button onClick={() => toggle(r.id)} className="text-[10px] uppercase tracking-widest underline">Détail</button>
                  <button onClick={() => remove(r.id)} title="Supprimer" className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-3.5 inline" />
                  </button>
                </td>
              </tr>
              {open === r.id && (
                <tr key={r.id + "-d"}><td colSpan={6} className="pb-4">
                  <div className="rounded-sm border border-border p-3 text-xs">
                    {!detail && <p className="text-muted-foreground">Chargement…</p>}
                    {detail && (
                      <>
                        {detail.report?.alertes?.length ? (
                          <ul className="mb-2 list-disc pl-4 space-y-1">
                            {detail.report.alertes.map((a: string, i: number) => <li key={i}>{a}</li>)}
                          </ul>
                        ) : null}
                        <pre className="whitespace-pre-wrap font-sans leading-relaxed">{detail.report?.rapport_md}</pre>
                      </>
                    )}
                  </div>
                </td></tr>
              )}
            </>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">Aucun diagnostic archivé.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function CimaiseTab() {
  const stats = useServerFn(cimaiseStatsAdmin);
  const listMsg = useServerFn(listCimaiseMessagesAdmin);
  const delHist = useServerFn(deleteCimaiseUserHistoryAdmin);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-cimaise"], queryFn: () => stats() });
  const [openUser, setOpenUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);

  const openHistory = async (userId: string) => {
    if (openUser === userId) { setOpenUser(null); setMessages([]); return; }
    setOpenUser(userId);
    try { const rows = await listMsg({ data: { user_id: userId } }); setMessages(rows); }
    catch (e: any) { toast.error(e.message); }
  };

  const wipe = async (userId: string) => {
    if (!confirm("Supprimer tout l'historique Cimaise de cet utilisateur ?")) return;
    try {
      await delHist({ data: { user_id: userId } });
      toast.success("Historique supprimé");
      setOpenUser(null); setMessages([]);
      qc.invalidateQueries({ queryKey: ["admin-cimaise"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const totals = data?.totals ?? { messages: 0, questions: 0, users: 0 };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Questions" value={totals.questions} icon={ClipboardList} />
        <StatCard label="Utilisateurs actifs" value={totals.users} icon={Users} />
        <StatCard label="Messages totaux" value={totals.messages} icon={MessageCircle} />
      </div>
      <table className="w-full text-sm">
        <thead className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
          <tr><th className="text-left py-3">Utilisateur</th><th className="text-right">Questions</th><th className="text-right">Dernier échange</th><th></th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {(data?.per_user ?? []).map((u: any) => (
            <>
              <tr key={u.user_id}>
                <td className="py-2 mono text-xs">{u.email || u.user_id}</td>
                <td className="text-right mono text-xs">{u.questions}</td>
                <td className="text-right mono text-xs">{formatDateTime(u.last_at)}</td>
                <td className="text-right space-x-3">
                  <button onClick={() => openHistory(u.user_id)} className="text-[10px] uppercase tracking-widest underline">
                    {openUser === u.user_id ? "Fermer" : "Historique"}
                  </button>
                  <button onClick={() => wipe(u.user_id)} title="Effacer l'historique" className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-3.5 inline" />
                  </button>
                </td>
              </tr>
              {openUser === u.user_id && (
                <tr key={u.user_id + "-h"}><td colSpan={4} className="pb-4">
                  <div className="rounded-sm border border-border p-3 space-y-3 max-h-96 overflow-y-auto">
                    {messages.length === 0 && <p className="text-xs text-muted-foreground">Aucun message.</p>}
                    {messages.map((m) => (
                      <div key={m.id} className={m.role === "user" ? "" : "pl-3 border-l-2 border-border"}>
                        <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                          {m.role === "user" ? "Question" : "Cimaise"} · {formatDateTime(m.created_at)}
                        </p>
                        <p className="text-xs whitespace-pre-wrap">{m.content}</p>
                      </div>
                    ))}
                  </div>
                </td></tr>
              )}
            </>
          ))}
          {(!data || data.per_user.length === 0) && (
            <tr><td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">Aucune conversation Cimaise enregistrée.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <div className="border border-border rounded-sm p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" strokeWidth={1.5} />
        <p className="text-[10px] uppercase tracking-widest">{label}</p>
      </div>
      <p className="serif text-3xl mt-1">{value}</p>
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
