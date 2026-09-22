import { useCurrentProfile } from "@/hooks/use-profile";
import { canManageInventory, isAdminOrAbove, isSuperadmin as isSuperadminRole } from "@/lib/roles";

export type Identity = {
  /** Stable id used for responsibility/ownership in the database. */
  userId: string | null;
  displayName: string;
  role: string;
  /** Administrator oder Superadmin — Superadmin erbt alle Admin-Rechte. */
  isAdmin: boolean;
  /** Höchste Rolle: darf zusätzlich privilegierte Zugänge verwalten. */
  isSuperadmin: boolean;
  isSiteManager: boolean;
  isWarehouseManager: boolean;
  /** Operativer Gerätebetrieb: Admin, Superadmin und Lagerverwalter. */
  canOperate: boolean;
  /** Managers may act on machines they are not personally responsible for. */
  canManage: boolean;
  canManageMachines: boolean;
  isLoading: boolean;
};

/**
 * Single identity abstraction for all operational workflows (checkout/return).
 * Business logic must depend on this, not on Supabase email sessions directly.
 */
export function useIdentity(): Identity {
  const { user, profile, role, isLoading } = useCurrentProfile();
  const normalized = (role ?? "user").toLowerCase();
  const isAdmin = isAdminOrAbove(normalized);
  const isSiteManager =
    normalized === "site_manager" || normalized === "bauleiter" || normalized === "manager";
  const isWarehouseManager = normalized === "warehouse_manager";

  return {
    userId: profile?.id ?? user?.id ?? null,
    displayName: profile?.full_name ?? user?.email ?? "Unbekannt",
    role: normalized,
    isAdmin,
    isSuperadmin: isSuperadminRole(normalized),
    isSiteManager,
    isWarehouseManager,
    canOperate: canManageInventory(normalized),
    canManage: isAdmin || isSiteManager || isWarehouseManager,
    canManageMachines: isAdmin || isSiteManager || isWarehouseManager,
    isLoading,
  };
}
