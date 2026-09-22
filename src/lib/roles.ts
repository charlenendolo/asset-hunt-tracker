/**
 * Zentrale Rollenlogik (client- und serverseitig nutzbar).
 *
 * Hierarchie: superadmin > admin > site_manager > warehouse_manager > user.
 * Der Superadmin erbt sämtliche Administrator-Rechte; zusätzlich darf nur er
 * privilegierte Zugänge (Administrator/Superadmin) verwalten.
 *
 * Diese Datei enthält ausschließlich Regeln — die verbindliche Prüfung erfolgt
 * immer serverseitig gegen die Rolle aus der Datenbank.
 */

export const APP_ROLES = ["superadmin", "admin", "site_manager", "warehouse_manager", "user"] as const;

export type AppRole = (typeof APP_ROLES)[number];

/** Rollen mit Zugriff auf sicherheitskritische Kontoverwaltung. */
export const PRIVILEGED_ROLES = ["admin", "superadmin"] as const;

/** Rollen, die ein normaler Administrator vergeben und verwalten darf. */
export const ADMIN_MANAGEABLE_ROLES = ["user", "site_manager", "warehouse_manager"] as const;

export function normalizeRole(role: string | null | undefined): string {
  return (role ?? "user").toLowerCase();
}

export function isSuperadmin(role: string | null | undefined): boolean {
  return normalizeRole(role) === "superadmin";
}

/** Administrator oder Superadmin — ersetzt alle alten `role === "admin"`-Prüfungen. */
export function isAdminOrAbove(role: string | null | undefined): boolean {
  return PRIVILEGED_ROLES.includes(normalizeRole(role) as (typeof PRIVILEGED_ROLES)[number]);
}

/** Ist das Zielkonto ein privilegierter Zugang (Administrator/Superadmin)? */
export function isPrivilegedTarget(role: string | null | undefined): boolean {
  return isAdminOrAbove(role);
}

/** Darf der Aufrufer Benutzerzugänge überhaupt verwalten? */
export function canManageUsers(callerRole: string | null | undefined): boolean {
  return isAdminOrAbove(callerRole);
}

/** Darf der Aufrufer privilegierte Zugänge verwalten? Nur Superadmin. */
export function canManagePrivilegedUsers(callerRole: string | null | undefined): boolean {
  return isSuperadmin(callerRole);
}

/** Rollen, die der Aufrufer vergeben darf. */
export function assignableRoles(callerRole: string | null | undefined): readonly string[] {
  return isSuperadmin(callerRole) ? APP_ROLES : ADMIN_MANAGEABLE_ROLES;
}

/**
 * Darf der Aufrufer diesen Zielzugang verwalten (bearbeiten, deaktivieren,
 * löschen, Passwort setzen)? Privilegierte Ziele sind dem Superadmin
 * vorbehalten.
 */
export function canManageTarget(
  callerRole: string | null | undefined,
  targetRole: string | null | undefined,
): boolean {
  if (!canManageUsers(callerRole)) return false;
  if (isPrivilegedTarget(targetRole)) return canManagePrivilegedUsers(callerRole);
  return true;
}

export const PRIVILEGED_DENIED =
  "Nur ein Superadmin darf privilegierte Zugänge (Administrator/Superadmin) verwalten.";
export const LAST_SUPERADMIN =
  "Mindestens ein aktiver Superadmin muss bestehen bleiben.";
