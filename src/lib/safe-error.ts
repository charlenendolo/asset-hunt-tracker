/**
 * Interne Fehlerdetails bleiben im Server-Log, der Nutzer sieht eine
 * verständliche Meldung ohne Datenbank- oder Schemainformationen.
 */
export function failSafely(message: string, error: unknown, scope: string): never {
  console.error(`[${scope}]`, error);
  throw new Error(message);
}
