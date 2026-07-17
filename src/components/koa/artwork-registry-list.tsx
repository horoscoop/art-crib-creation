/**
 * KOA Guardian — Registre du parc d'œuvres (module Audit, Phase 2).
 *
 * Adaptation mobile-first (colonne unique, cohérente avec le layout
 * max-w-md existant de /inspections) de la vue "Parc d'Œuvres" du
 * prototype AI Studio : recherche, filtre par statut, mode sélection
 * par lot, cartes avec photo/statut/alertes.
 *
 * Branché sur listArtworkRegistry (données réelles Supabase),
 * pas de données mockées.
 *
 * À placer dans src/components/koa/artwork-registry-list.tsx,
 * puis à insérer comme 3e TabsTrigger/TabsContent ("Registre") dans
 * src/routes/_app.inspections.tsx — voir note d'intégration en bas de fichier.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Search, Layers, AlertTriangle } from "lucide-react";
import { listArtworkRegistry, type RegistryArtwork } from "@/lib/artwork-registry.functions";
import { formatDate } from "@/lib/koa-helpers";

// Réutilise exactement les mêmes libellés/couleurs que le Planning existant
// (src/routes/_app.inspections.tsx) pour ne pas introduire un second vocabulaire.
const STATUS_META: Record<RegistryArtwork["inspection_status"], { label: string; color: string }> = {
  jamais_inspecte: { label: "Jamais inspecté", color: "border-muted-foreground text-muted-foreground" },
  en_retard: { label: "En retard", color: "border-destructive text-destructive" },
  echeance_proche: { label: "Sous 7 jours", color: "border-vigilance text-vigilance" },
  a_jour: { label: "À jour", color: "border-ok text-ok" },
};

export function ArtworkRegistryList() {
  const listRegistryFn = useServerFn(listArtworkRegistry);
  const { data: registry = [], isLoading } = useQuery({
    queryKey: ["artwork-registry"],
    queryFn: () => listRegistryFn(),
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RegistryArtwork["inspection_status"]>("all");
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return registry.filter((a) => {
      const matchesQuery =
        !q ||
        a.title.toLowerCase().includes(q) ||
        (a.artist ?? "").toLowerCase().includes(q) ||
        (a.location ?? "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || a.inspection_status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [registry, search, statusFilter]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-4">
      {/* Barre de recherche + filtre statut */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher titre, artiste, emplacement..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-secondary border border-border pl-9 pr-3 py-2 rounded-lg text-xs focus:outline-none focus:border-accent"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="flex-1 bg-secondary border border-border px-3 py-2 rounded-lg text-[10px] uppercase tracking-widest focus:outline-none focus:border-accent"
          >
            <option value="all">Tous les statuts</option>
            <option value="en_retard">En retard</option>
            <option value="echeance_proche">Sous 7 jours</option>
            <option value="jamais_inspecte">Jamais inspecté</option>
            <option value="a_jour">À jour</option>
          </select>
          <button
            onClick={() => {
              setBatchMode(!batchMode);
              setSelectedIds([]);
            }}
            className={`gallery-tab flex items-center gap-1 shrink-0 ${batchMode ? "border-accent text-accent" : "border-border"}`}
            data-active={batchMode}
          >
            <Layers className="size-3.5" /> Lot
          </button>
        </div>
      </div>

      {/* Bandeau mode lot actif */}
      {batchMode && selectedIds.length > 0 && (
        <div className="p-3 rounded-lg border border-accent bg-accent/10 text-xs flex items-center justify-between gap-2">
          <span>{selectedIds.length} œuvre{selectedIds.length > 1 ? "s" : ""} sélectionnée{selectedIds.length > 1 ? "s" : ""}</span>
          {/* La saisie de maintenance par lot est traitée en Phase 3 :
              ce bouton transmettra selectedIds au formulaire de maintenance groupée. */}
          <span className="text-[10px] text-muted-foreground italic">Saisie par lot — Phase 3</span>
        </div>
      )}

      {isLoading && <p className="text-xs text-muted-foreground">Chargement du registre…</p>}
      {!isLoading && filtered.length === 0 && (
        <p className="text-xs text-muted-foreground">Aucune œuvre ne correspond à ces critères.</p>
      )}

      {/* Liste (colonne unique, cohérente avec le layout mobile max-w-md existant) */}
      <ul className="space-y-3">
        {filtered.map((art) => {
          const meta = STATUS_META[art.inspection_status];
          const isSelected = selectedIds.includes(art.artwork_id);
          return (
            <li
              key={art.artwork_id}
              onClick={() => (batchMode ? toggleSelect(art.artwork_id) : undefined)}
              className={`gallery-card-hover border rounded-xl overflow-hidden bg-card ${
                isSelected ? "border-accent ring-2 ring-accent/30" : "border-border"
              } ${batchMode ? "cursor-pointer" : ""}`}
            >
              <div className="flex gap-3 p-3">
                {batchMode && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(art.artwork_id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 shrink-0"
                  />
                )}
                {art.photo_url && (
                  <img
                    src={art.photo_url}
                    alt={art.title}
                    className="size-16 rounded-lg object-cover border border-border shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    {batchMode ? (
                      <p className="serif text-sm truncate">{art.title}</p>
                    ) : (
                      <Link
                        to="/artworks/$id"
                        params={{ id: art.artwork_id }}
                        className="serif text-sm truncate underline-offset-4 hover:underline"
                      >
                        {art.title}
                      </Link>
                    )}
                    <span className={`text-[9px] uppercase tracking-widest border px-1.5 py-0.5 rounded shrink-0 ${meta.color}`}>
                      {meta.label}
                    </span>
                  </div>
                  {art.artist && <p className="text-[11px] italic text-muted-foreground truncate">{art.artist}</p>}
                  <p className="text-[10px] text-muted-foreground truncate">
                    📍 {art.location ?? "—"} · {art.weight_kg} kg
                  </p>
                  {art.koa_system && (
                    <p className="text-[10px] text-muted-foreground truncate">🔧 {art.koa_system}</p>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                    <span>{art.next_due_at ? `Échéance ${formatDate(art.next_due_at)}` : "Pas de planning"}</span>
                    {art.active_alerts_count > 0 && (
                      <span className="flex items-center gap-1 text-destructive font-semibold">
                        <AlertTriangle className="size-3" /> {art.active_alerts_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ============================================================
   NOTE D'INTÉGRATION dans src/routes/_app.inspections.tsx :

   1. import { ArtworkRegistryList } from "@/components/koa/artwork-registry-list";

   2. Remplacer :
        <TabsList className="grid grid-cols-2 w-full">
      par :
        <TabsList className="grid grid-cols-3 w-full">

   3. Ajouter un 3e trigger, avant "journal" ou après "planning" :
        <TabsTrigger value="registre">Registre</TabsTrigger>

   4. Ajouter le contenu associé :
        <TabsContent value="registre" className="mt-4">
          <ArtworkRegistryList />
        </TabsContent>
   ============================================================ */
