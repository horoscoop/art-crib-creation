import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Bell, MessageCircle, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Œuvres", icon: Home },
  { to: "/alerts", label: "Alertes", icon: Bell },
  { to: "/scan", label: "Scan", icon: ScanLine },
  { to: "/chat", label: "Cimaise", icon: MessageCircle },
] as const;

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur">
      <ul className="grid grid-cols-4 max-w-md mx-auto">
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
