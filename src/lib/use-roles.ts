import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export function useRoles() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["roles", user?.id],
    queryFn: async () => {
      if (!user) return [] as string[];
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return (data ?? []).map((r) => r.role as string);
    },
    enabled: !!user,
    staleTime: 60_000,
  });
  const roles = data ?? [];
  return {
    roles,
    isAdmin: roles.includes("admin"),
    isExpert: roles.includes("expert_koa"),
    isAdminOrExpert: roles.includes("admin") || roles.includes("expert_koa"),
  };
}
