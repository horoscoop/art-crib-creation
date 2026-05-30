import { cn } from "@/lib/utils";

type Severity = "ok" | "vigilance" | "critical";

const styles: Record<Severity, string> = {
  ok: "bg-ok/10 text-ok border-ok/30",
  vigilance: "bg-vigilance/15 text-vigilance-foreground border-vigilance/40",
  critical: "bg-destructive/10 text-destructive border-destructive/30",
};

const labels: Record<Severity, string> = {
  ok: "Stable",
  vigilance: "Vigilance",
  critical: "Alerte",
};

export function StatusBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px] tracking-[0.15em] uppercase px-2 py-1 border rounded-sm",
        styles[severity],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", severity === "ok" ? "bg-ok" : severity === "vigilance" ? "bg-vigilance" : "bg-destructive")} />
      {labels[severity]}
    </span>
  );
}
