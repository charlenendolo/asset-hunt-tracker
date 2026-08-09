import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;

export type AppRole = "admin" | "manager" | "user";

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
      return (data?.[0] ?? null) as Profile | null;
    },
  });

  const role = (query.data?.role ?? "user") as string;

  return {
    user: user ?? null,
    profile: query.data ?? null,
    role,
    isAdmin: role === "admin",
    // Bauleiter = site_manager (Legacy-Aliasse bleiben tolerant).
    isManager:
      role === "site_manager" ||
      role === "manager" ||
      role === "bauleiter" ||
      role === "admin",
    isLoading: userLoading || query.isLoading,
  };
}
