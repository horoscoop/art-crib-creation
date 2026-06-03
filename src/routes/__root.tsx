import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/lib/auth-context";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground">KOA Guardian</p>
        <h1 className="serif text-6xl mt-3">404</h1>
        <p className="mt-3 text-sm text-muted-foreground">Cette œuvre n'est pas dans votre parc.</p>
        <Link to="/" className="mt-6 inline-block text-sm underline underline-offset-4">Retour</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="serif text-2xl">Un imprévu</h1>
        <p className="mt-2 text-sm text-muted-foreground">Quelque chose n'a pas pu être chargé.</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 px-4 py-2 bg-primary text-primary-foreground text-sm"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { name: "theme-color", content: "#f7f5f0" },
      { title: "KOA Guardian — Conservation préventive" },
      { name: "description", content: "Monitoring intelligent des installations d'œuvres d'art. Capteurs, alertes et maintenance prédictive." },
      { property: "og:title", content: "KOA Guardian — Conservation préventive" },
      { name: "twitter:title", content: "KOA Guardian — Conservation préventive" },
      { property: "og:description", content: "Monitoring intelligent des installations d'œuvres d'art. Capteurs, alertes et maintenance prédictive." },
      { name: "twitter:description", content: "Monitoring intelligent des installations d'œuvres d'art. Capteurs, alertes et maintenance prédictive." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b20bb6ad-5268-493c-819a-7bbec24560f7/id-preview-7d5d384b--78315e02-6a86-483a-9907-40bcd3112992.lovable.app-1780461878991.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b20bb6ad-5268-493c-819a-7bbec24560f7/id-preview-7d5d384b--78315e02-6a86-483a-9907-40bcd3112992.lovable.app-1780461878991.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
