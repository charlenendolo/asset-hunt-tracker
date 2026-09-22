import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { isAdminOrAbove, isSuperadmin } from "@/lib/roles";

export type Profile = Tables<"profiles">;

export type { AppRole } from "@/lib/roles";

/** Current auth user id (client session). */
export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "user"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) return null;
      return data.user ?? null;
    },
  });
}

/** Profile row of the signed-in user, incl. role. */
export function useCurrentProfile() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const query = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // role/active are privileged columns; current_profile() returns them
      // for the signed-in user only.
      const { data, error } = await supabase.rpc("current_profile");
      if (error) throw error;
      const row = (data?.[0] ?? null) as Profile | null;
      // Deaktivierte Zugänge werden sofort abgemeldet; serverseitig werden ihre
      // Vorgänge ohnehin abgelehnt.
      if (row && row.active === false) {
        await supabase.auth.signOut();
        return null;
      }
      return row;
    },
  });

  const role = (query.data?.role ?? "user") as string;

  return {
    user: user ?? null,
    profile: query.data ?? null,
    role,
    // Superadmin erbt sämtliche Administrator-Rechte.
    isAdmin: isAdminOrAbove(role),
    isSuperadmin: isSuperadmin(role),
    // Bauleiter = site_manager (Legacy-Aliasse bleiben tolerant).
    isManager:
      role === "site_manager" ||
      role === "manager" ||
      role === "bauleiter" ||
      role === "warehouse_manager" ||
      isAdminOrAbove(role),
    isLoading: userLoading || query.isLoading,
  };
}
