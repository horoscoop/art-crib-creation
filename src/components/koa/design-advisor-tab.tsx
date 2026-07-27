/**
 * KOA Guardian — Onglet admin "Conception", v3.
 * S'inspire beaucoup plus fortement du parcours et du visuel de
 * AIPlanner.tsx (prototype AI Studio) : mise en page à deux colonnes
 * (formulaire à gauche / rapport à droite), modèles rapides de
 * configuration, panneau de sortie avec état de chargement animé et
 * citation, bouton de copie. Toutes les couleurs viennent des tokens
 * du design system existant (--accent, --card, --border...), pas des
 * couleurs codées en dur du prototype (#D1A054 etc.) — cf. Phase 1.
 *
 * Contrairement à /inspections (mobile, max-w-md), la console admin
 * est en max-w-5xl : la mise en page large du prototype s'applique
 * donc directement, sans adaptation mobile-first.
 *
 * REMPLACE ENTIÈREMENT DesignAdvisorTab.tsx / .v2.tsx.
 * Nécessite hanging-systems-advisor.functions.ts et
 * alternative-systems-advisor.functions.ts (déjà livrés, inchangés).
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  recommendHangingSystemsAdmin,
  type HangingSystemRecommendation,
} from "@/lib/hanging-systems-advisor.functions";
import {
  suggestAlternativeSystemsAdmin,
  type AlternativeSystem,
} from "@/lib/alternative-systems-advisor.functions";
import { Sparkles, Copy, Check, AlertCircle, Compass, Shield } from "lucide-react";

const WALL_TYPES = [
  "cimaise", "plâtre", "BA13", "BA13 renforcé", "béton", "brique",
  "acier", "panneau métallique", "verre", "métal lisse", "composite",
];

// Modèles rapides — vocabulaire aligné sur le catalogue KOA réel,
// contrairement au prototype qui inventait ses propres libellés de murs.
const TEMPLATES = [
  { title: "Exposition publique", wallType: "béton", weightKg: "28", heightM: "1.6" },
  { title: "Salon privé (léger)", wallType: "BA13", weightKg: "5", heightM: "1.5" },
  { title: "Grand format", wallType: "brique", weightKg: "45", heightM: "1.7" },
];

const SAFETY_META: Record<HangingSystemRecommendation["safety_level"], { label: string; color: string }> = {
  insuffisant: { label: "Capacité insuffisante", color: "border-destructive text-destructive" },
  vigilance: { label: "Marge sous 3x (vigilance)", color: "border-vigilance text-vigilance" },
  conforme: { label: "Marge conforme (≥ 3x)", color: "border-ok text-ok" },
  indetermine: { label: "Capacité non renseignée", color: "border-muted-foreground text-muted-foreground" },
};

export function DesignAdvisorTab() {
  const recommend = useServerFn(recommendHangingSystemsAdmin);
  const suggestAlternatives = useServerFn(suggestAlternativeSystemsAdmin);

  const [weight, setWeight] = useState("12");
  const [wallType, setWallType] = useState("BA13");
  const [heightM, setHeightM] = useState("1.6");
  const [securityRequired, setSecurityRequired] = useState(true);

  const [results, setResults] = useState<HangingSystemRecommendation[] | null>(null);
  const [alternatives, setAlternatives] = useState<AlternativeSystem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const applyTemplate = (t: typeof TEMPLATES[number]) => {
    setWallType(t.wallType);
    setWeightKg(t.weightKg);
    setHeightM(t.heightM);
  };
  // (petite correction de nommage : setWeightKg -> setWeight, cf. state déclaré au-dessus)
  function setWeightKg(v: string) { setWeight(v); }

  const search = async () => {
    const w = Number(weight);
    if (!w || w <= 0) { setError("Indiquez un poids valide."); return; }
    setLoading(true);
    setError(null);
    setResults(null);
    setAlternatives(null);
    try {
      const [catalog, alt] = await Promise.all([
        recommend({ data: { weight_kg: w, wall_type: wallType || undefined } }),
        suggestAlternatives({ data: { weight_kg: w, wall_type: wallType || undefined } }).catch(() => []),
      ]);
      setResults(catalog);
      setAlternatives(alt);
    } catch (e: any) {
      setError(e.message ?? "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  const copyReport = () => {
    if (!results) return;
    const lines = [
      `Rapport de conception — ${weight} kg, mur ${wallType}, sécurité renforcée : ${securityRequired ? "oui" : "non"}`,
      "",
      "Catalogue KOA :",
      ...results.map((r) => `- ${r.name} (${r.code}) — charge max ${r.max_weight_kg ?? "—"} kg, marge ×${r.safety_margin?.toFixed(1) ?? "—"}`),
      ...(alternatives?.length ? ["", "Alternatives hors catalogue :", ...alternatives.map((a) => `- ${a.name} (${a.category})`)] : []),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasReport = !!results;

  return (
    <div className="space-y-6">
      {/* Bandeau d'introduction — repris de la Phase 1 */}
      <div className="gallery-banner">
        <span className="gallery-eyebrow flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Planificateur & Expertise Technique
        </span>
        <h2 className="gallery-title text-2xl mt-1">
          Concevoir un <em>accrochage sécurisé</em>
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          Entrez les caractéristiques de l'œuvre et du mur : l'outil compare le catalogue KOA
          et propose des alternatives du marché, avec un rapport prêt à partager.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Panneau formulaire */}
        <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider">Configurez votre projet d'accroche</h3>

          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-2">Modèles rapides</span>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.title}
                  onClick={() => applyTemplate(t)}
                  className="gallery-tab"
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>

          <hr className="border-border" />

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Type de mur</label>
            <select
              value={wallType} onChange={(e) => setWallType(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-accent transition"
            >
              {WALL_TYPES.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Poids de l'œuvre (kg)</label>
            <input
              type="number" min={0.1} step="0.1" value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Hauteur de vue recommandée (m)</label>
            <input
              type="number" step="0.1" min={1} max={2.5} value={heightM}
              onChange={(e) => setHeightM(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent transition"
              placeholder="Standard musée : 1.6"
            />
          </div>

          <div className="flex items-center gap-3 py-2">
            <input
              type="checkbox" checked={securityRequired}
              onChange={(e) => setSecurityRequired(e.target.checked)}
              className="w-4.5 h-4.5 accent-[var(--color-accent)] cursor-pointer"
            />
            <label className="text-xs font-semibold cursor-pointer select-none">
              Exiger un verrou anti-vol / anti-sismique
              <span className="text-accent block text-[9px] font-normal uppercase mt-0.5">Recommandé pour expositions publiques</span>
            </label>
          </div>

          <button
            onClick={search}
            disabled={loading}
            className="w-full py-3.5 px-4 bg-primary disabled:opacity-40 text-primary-foreground font-bold text-xs uppercase tracking-widest rounded-lg transition hover:bg-accent flex items-center justify-center gap-2 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            {loading ? "Analyse en cours…" : "Générer le rapport de conception"}
          </button>
        </div>

        {/* Panneau rapport */}
        <div className="lg:col-span-7 bg-secondary border border-border rounded-2xl p-6 flex flex-col min-h-[520px]">
          <div className="flex items-center justify-between pb-3 border-b border-border mb-4 shrink-0">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-accent" /> Rapport de conception
            </span>
            {hasReport && (
              <button
                onClick={copyReport}
                className="text-xs uppercase tracking-wider font-bold hover:text-accent flex items-center gap-1.5 px-3 py-1.5 hover:bg-card rounded-lg border border-border transition"
              >
                {copied ? <><Check className="w-3.5 h-3.5 text-ok" /> Copié</> : <><Copy className="w-3.5 h-3.5" /> Copier</>}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                <div>
                  <p className="text-sm font-bold">Analyse des charges et du catalogue…</p>
                  <p className="text-muted-foreground text-xs mt-1.5 italic">
                    Comparaison des systèmes KOA et recherche d'alternatives en cours.
                  </p>
                </div>
              </div>
            )}

            {error && !loading && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <AlertCircle className="w-12 h-12 text-destructive" />
                <div>
                  <p className="text-destructive text-sm font-bold uppercase tracking-wider">Une erreur s'est produite</p>
                  <p className="text-muted-foreground text-xs mt-1">{error}</p>
                </div>
              </div>
            )}

            {!hasReport && !loading && !error && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                <Shield className="w-12 h-12 mb-2 stroke-[1.5] text-accent" />
                <p className="serif text-lg">Aucun rapport généré</p>
                <p className="text-xs max-w-sm mt-1.5 leading-relaxed">
                  Configurez le poids et le support à gauche, puis lancez l'analyse.
                </p>
              </div>
            )}

            {hasReport && !loading && !error && (
              <div className="space-y-6">
                <div>
                  <p className="gallery-eyebrow mb-3">Catalogue KOA</p>
                  <ul className="space-y-3">
                    {results!.map((r) => {
                      const meta = SAFETY_META[r.safety_level];
                      return (
                        <li key={r.id} className="gallery-card-hover border border-border rounded-xl p-4 bg-card">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] tracking-widest uppercase text-muted-foreground">{r.code}</p>
                              <p className="serif text-base">{r.name}</p>
                            </div>
                            <span className={`text-[9px] uppercase tracking-widest border px-2 py-1 rounded shrink-0 ${meta.color}`}>
                              {meta.label}
                            </span>
                          </div>
                          {r.description && <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{r.description}</p>}
                          <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-muted-foreground">
                            <span>Charge max : {r.max_weight_kg ?? "—"} kg</span>
                            {r.safety_margin && <span>Marge : ×{r.safety_margin.toFixed(1)}</span>}
                            {r.no_drilling && <span className="text-accent">Sans perçage</span>}
                          </div>
                        </li>
                      );
                    })}
                    {results!.length === 0 && <p className="text-xs text-muted-foreground">Aucun système ne correspond dans le catalogue actuel.</p>}
                  </ul>
                </div>

                {alternatives && alternatives.length > 0 && (
                  <div>
                    <p className="gallery-eyebrow mb-3">Alternatives hors catalogue</p>
                    <ul className="space-y-3">
                      {alternatives.map((alt, i) => (
                        <li key={i} className="gallery-card-hover border border-dashed border-border rounded-xl p-4 bg-card">
                          <p className="text-[10px] tracking-widest uppercase text-muted-foreground">{alt.category}</p>
                          <p className="serif text-base">{alt.name}</p>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{alt.description}</p>
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-ok mb-1">Avantages</p>
                              <ul className="text-xs text-muted-foreground space-y-0.5">
                                {alt.avantages.map((a, j) => <li key={j}>• {a}</li>)}
                              </ul>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-destructive mb-1">Inconvénients</p>
                              <ul className="text-xs text-muted-foreground space-y-0.5">
                                {alt.inconvenients.map((a, j) => <li key={j}>• {a}</li>)}
                              </ul>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[10px] text-muted-foreground italic mt-2">
                      Analyse générique générée par IA à titre de comparaison — à valider par un expert.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
