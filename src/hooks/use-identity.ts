import { useCurrentProfile } from "@/hooks/use-profile";

export type Identity = {
  /** Stable id used for responsibility/ownership in the database. */
  userId: string | null;
  displayName: string;
  role: string;
  isAdmin: boolean;
  isSiteManager: boolean;
  /** Managers may act on machines they are not personally responsible for. */
  canManage: boolean;
  isLoading: boolean;
};

/**
 * Single identity abstraction for all operational workflows (checkout/return).
 * Business logic must depend on this, not on Supabase email sessions directly —
 * a future employee-number/PIN identity can be plugged in here.
 */
export function useIdentity(): Identity {
  const { user, profile, role, isLoading } = useCurrentProfile();
  const normalized = (role ?? "user").toLowerCase();
  const isAdmin = normalized === "admin";
  const isSiteManager = normalized === "site_manager" || normalized === "bauleiter";

  return {
    userId: profile?.id ?? user?.id ?? null,
    displayName: profile?.full_name ?? user?.email ?? "Unbekannt",
    role: normalized,
    isAdmin,
    isSiteManager,
    canManage: isAdmin || isSiteManager,
    isLoading,
  };
}
