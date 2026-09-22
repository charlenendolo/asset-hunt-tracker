/**
 * Serverseitige Rollenprüfung für privilegierte Vorgänge.
 * Liest die Rolle über current_profile() mit dem Client des Aufrufers —
 * die privilegierten Spalten bleiben damit RLS-geschützt.
 */
type RpcClient = {
  rpc: (fn: "current_profile") => Promise<{
    data: Array<{ id: string; role: string | null; active: boolean | null }> | null;
    error: unknown;
  }>;
};

export type ManagerRole = "admin" | "site_manager";

export async function currentRole(supabase: unknown): Promise<string> {
  const { data } = await (supabase as RpcClient).rpc("current_profile");
  const profile = data?.[0];
  if (!profile || profile.active === false) throw new Error("Zugang ist nicht aktiv.");
  return (profile.role ?? "user").toLowerCase();
}

/** admin immer, site_manager optional. Wirft mit deutscher Fehlermeldung. */
export async function requireManager(
  supabase: unknown,
  options?: { adminOnly?: boolean; message?: string },
): Promise<string> {
  const role = await currentRole(supabase);
  const allowed = options?.adminOnly
    ? ["superadmin", "admin"]
    : ["superadmin", "admin", "site_manager", "warehouse_manager"];
  if (!allowed.includes(role)) {
    throw new Error(options?.message ?? "Dir fehlen die Rechte für diesen Vorgang.");
  }
  return role;
}

/** Gerätebezogene Stammpflege: zusätzlich für Lagerverwalter. */
export async function requireDeviceManager(supabase: unknown, message?: string): Promise<string> {
  const role = await currentRole(supabase);
  if (!["superadmin", "admin", "site_manager", "warehouse_manager"].includes(role)) {
    throw new Error(message ?? "Dir fehlen die Rechte für diesen Vorgang.");
  }
  return role;
}

/**
 * Zero-Trust-Basisprüfung für jede authentifizierte Aktion.
 * Ein Zugriffstoken bleibt nach einer Deaktivierung bis zum Ablauf technisch
 * gültig — deshalb wird der Aktivstatus bei jedem Vorgang frisch geprüft.
 */
export async function requireActiveUser(supabase: unknown): Promise<string> {
  return currentRole(supabase);
}

/** Interne Details bleiben im Log, der Nutzer sieht eine verständliche Meldung. */
export function failSafely(message: string, error: unknown, scope: string): never {
  console.error(`[${scope}]`, error);
  throw new Error(message);
}

/**
 * Operativer Gerätebetrieb (Admin-gleichwertig für Lagerverwalter).
 * Nicht für Benutzerverwaltung und nicht für Deaktivieren/Löschen von Geräten.
 */
export async function requireInventoryManager(
  supabase: unknown,
  message?: string,
): Promise<string> {
  const role = await currentRole(supabase);
  if (!["superadmin", "admin", "warehouse_manager"].includes(role)) {
    throw new Error(message ?? "Dir fehlen die Rechte für diesen Vorgang.");
  }
  return role;
}
