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
  const allowed = options?.adminOnly ? ["admin"] : ["admin", "site_manager"];
  if (!allowed.includes(role)) {
    throw new Error(options?.message ?? "Dir fehlen die Rechte für diesen Vorgang.");
  }
  return role;
}
