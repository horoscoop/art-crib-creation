import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Bell, ScanLine, Shield, Eye, MessageCircle, LayoutDashboard, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRoles } from "@/lib/use-roles";
import { useActiveAlertsCount } from "@/lib/use-active-alerts";

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, isExpert } = useRoles();
  const activeAlerts = useActiveAlertsCount();

  const items = isAdmin
    ? [
        { to: "/dashboard", label: "Supervision", icon: LayoutDashboard },
        { to: "/", label: "Œuvres", icon: Home },
        { to: "/alerts", label: "Alertes", icon: Bell, badge: activeAlerts },
        { to: "/expert-lab", label: "Expert Lab", icon: FlaskConical },
        { to: "/chat", label: "Cimaise", icon: MessageCircle },
        { to: "/admin", label: "Admin", icon: Shield },
      ]
    : isExpert
    ? [
        { to: "/dashboard", label: "Supervision", icon: LayoutDashboard },
        { to: "/", label: "Œuvres", icon: Home },
        { to: "/alerts", label: "Alertes", icon: Bell, badge: activeAlerts },
        { to: "/expert-lab", label: "Expert Lab", icon: FlaskConical },
        { to: "/vision", label: "Vision", icon: Eye },
        { to: "/chat", label: "Cimaise", icon: MessageCircle },
      ]
    : [
        { to: "/", label: "Œuvres", icon: Home },
        { to: "/alerts", label: "Alertes", icon: Bell, badge: activeAlerts },
        { to: "/vision", label: "Vision", icon: Eye },
        { to: "/scan", label: "Scan", icon: ScanLine },
        { to: "/chat", label: "Cimaise", icon: MessageCircle },
      ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur">
      <ul className={cn("grid max-w-md mx-auto", items.length === 6 ? "grid-cols-6" : "grid-cols-5")}>
        {items.map(({ to, label, icon: Icon, badge }) => {
          const active = to === "/" ? path === "/" : path.startsWith(to);
          return (
            <li key={to}>
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 text-[10px] tracking-wider uppercase",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="relative">
                  <Icon className="size-5" strokeWidth={1.5} />
                  {badge && badge > 0 ? (
                    <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-medium grid place-items-center leading-none">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
