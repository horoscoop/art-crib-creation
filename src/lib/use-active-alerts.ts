import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

/**
 * Nombre d'alertes actives, tenu à jour en temps réel via Supabase Realtime.
 * Utilisé par le badge de la BottomNav et les vues Alertes / Dashboard.
 */
export function useActiveAlertsCount() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["alerts-active-count"],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("alerts")
        .select("id", { head: true, count: "exact" })
        .eq("resolved", false);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("alerts-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        qc.invalidateQueries({ queryKey: ["alerts-active-count"] });
        qc.invalidateQueries({ queryKey: ["alerts-all"] });
        qc.invalidateQueries({ queryKey: ["supervision-dashboard"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, user]);

  return query.data ?? 0;
}
