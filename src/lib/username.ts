/** Gemeinsame Regeln für Benutzernamen (Client + Server). */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 32;

export const USERNAME_HINT =
  "3–32 Zeichen: Buchstaben, Ziffern, Punkt, Bindestrich, Unterstrich. Keine Leerzeichen.";

/** Einheitliche Normalisierung: getrimmt und klein geschrieben. */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return /^[a-z0-9._-]{3,32}$/.test(normalizeUsername(value));
}

/** Sehr einfache E-Mail-Erkennung für die Unterscheidung im Login-Feld. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
