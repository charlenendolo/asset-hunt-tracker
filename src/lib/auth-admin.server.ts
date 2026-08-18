/**
 * Server-only Hilfen für privilegierte Auth-Vorgänge.
 * Der Service-Role-Key verlässt niemals den Server; alle Aufrufer prüfen
 * vorher über ihren eigenen (RLS-gebundenen) Client, dass sie Admin sind.
 */

function authAdminHeaders() {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

/**
 * Beendet alle aktiven Sitzungen eines Benutzers (alle Geräte/Browser).
 * GoTrue-Admin-Endpunkt; supabase-js bietet dafür keinen Wrapper.
 */
export async function revokeAllSessions(userId: string): Promise<boolean> {
  const url = `${process.env["SUPABASE_URL"]!}/auth/v1/admin/users/${userId}/logout`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: authAdminHeaders(),
      body: JSON.stringify({ scope: "global" }),
    });
    if (!res.ok) {
      console.error("[auth-admin] session revoke failed", res.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[auth-admin] session revoke error", (error as Error).message);
    return false;
  }
}

/** Zufälliges, nirgends gespeichertes Passwort (für gesperrte Archiv-Zugänge). */
export function randomLockPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `Lk!${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}A1`;
}
