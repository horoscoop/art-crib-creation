/**
 * KOA Guardian — Bandeau d'en-tête du module Audit (Registre).
 *
 * Reprend l'ergonomie visuelle du prototype AI Studio (bandeau carte blanche,
 * cercle décoratif en fond, eyebrow + titre serif italique accentué) en
 * réutilisant exclusivement les tokens du design system existant
 * ("mur blanc de galerie" — styles.css) : --accent, --border, --font-serif,
 * StatusBadge (ok/vigilance/critical).
 *
 * À placer dans src/components/koa/audit-registry-banner.tsx
 * Utilisé en tête de la route /inspections (ou d'une future route /audit).
 */
import { StatusBadge } from "@/components/koa/status-badge";

interface AuditRegistryBannerProps {
  totalArtworks: number;
  healthScore: number; // 0-100, cf. compliance-report.functions.ts
  criticalAlerts: number;
}

export function AuditRegistryBanner({
  totalArtworks,
  healthScore,
  criticalAlerts,
}: AuditRegistryBannerProps) {
  const severity = criticalAlerts > 0 ? "critical" : healthScore < 80 ? "vigilance" : "ok";

  return (
    <div className="gallery-banner flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
      <div className="space-y-2 relative z-10">
        <span className="gallery-eyebrow">Audit &amp; Conformité Assurance</span>
        <h2 className="gallery-title text-3xl tracking-tight leading-none">
          Registre des <em>Accrochages Suivis</em>
        </h2>
        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
          {totalArtworks} œuvre{totalArtworks > 1 ? "s" : ""} sous surveillance —
          score de santé global {healthScore}/100.
        </p>
      </div>
      <div className="shrink-0 relative z-10">
        <StatusBadge severity={severity} />
      </div>
    </div>
  );
}
