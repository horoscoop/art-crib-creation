/**
 * KOA Guardian — src/lib/auth-context.tsx
 * CORRECTIF : le suivi des connexions n'enregistrait jamais rien car
 * l'insert se faisait côté client (bloqué silencieusement, probablement
 * par la policy RLS qui interroge auth.users). On utilise désormais
 * logConnectionEventAdmin, la fonction serveur déjà prévue à cet effet
 * (commentaire d'origine : "fallback fiable, RLS bypass") mais jamais
 * appelée jusqu'ici.
 *
 * REMPLACE ENTIÈREMENT le fichier existant.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { logConnectionEventAdmin } from "@/lib/admin.functions";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const logEvent = useServerFn(logConnectionEventAdmin);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setLoading(false);
      if (event === "SIGNED_IN" && s?.user) {
        logEvent({
          data: {
            event: "sign_in",
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          },
        }).catch((err) => {
          // Ne bloque jamais la connexion de l'utilisateur, mais on trace
          // l'échec en console pour ne plus jamais avoir un suivi silencieusement mort.
          console.error("Échec journalisation connexion :", err);
        });
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
