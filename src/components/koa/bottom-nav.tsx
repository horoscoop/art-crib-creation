import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Bell, ScanLine, Shield, Radio, Eye, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/lib/use-is-admin";

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = useIsAdmin();
  const items = isAdmin
    ? [
        { to: "/", label: "Œuvres", icon: Home },
        { to: "/alerts", label: "Alertes", icon: Bell },
        { to: "/vision", label: "Vision", icon: Eye },
        { to: "/gateways", label: "Flux", icon: Radio },
        { to: "/admin", label: "Admin", icon: Shield },
      ]
    : [
        { to: "/", label: "Œuvres", icon: Home },
        { to: "/alerts", label: "Alertes", icon: Bell },
        { to: "/vision", label: "Vision", icon: Eye },
        { to: "/scan", label: "Scan", icon: ScanLine },
        { to: "/chat", label: "Cimaise", icon: MessageCircle },
      ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur">
      <ul className="grid grid-cols-5 max-w-md mx-auto">
        {items.map(({ to, label, icon: Icon }) => {
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
                <Icon className="size-5" strokeWidth={1.5} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
