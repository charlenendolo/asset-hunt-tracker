/** Gemeinsame Passwortregeln für Client-Validierung und Serverprüfung. */
export const PASSWORD_MIN = 10;

export const PASSWORD_RULES = [
  `Mindestens ${PASSWORD_MIN} Zeichen`,
  "Mindestens ein Großbuchstabe",
  "Mindestens ein Kleinbuchstabe",
  "Mindestens eine Ziffer",
] as const;

/** Gibt null zurück, wenn das Passwort gültig ist, sonst einen Hinweistext. */
export function checkPassword(value: string): string | null {
  if (value.length < PASSWORD_MIN) return `Das Passwort braucht mindestens ${PASSWORD_MIN} Zeichen.`;
  if (!/[A-ZÄÖÜ]/.test(value)) return "Das Passwort braucht mindestens einen Großbuchstaben.";
  if (!/[a-zäöüß]/.test(value)) return "Das Passwort braucht mindestens einen Kleinbuchstaben.";
  if (!/[0-9]/.test(value)) return "Das Passwort braucht mindestens eine Ziffer.";
  return null;
}

/** Kennzeichnet interne PIN-Adressen, die nie als E-Mail-Zugang gelten. */
export function isPinOnlyEmail(email: string | null | undefined): boolean {
  return !email || email.endsWith("@assethunt.internal");
}
