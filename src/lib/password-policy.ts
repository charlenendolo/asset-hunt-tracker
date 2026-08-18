/** Gemeinsame Passwortregeln für Client-Validierung und Serverprüfung. */
export const PASSWORD_MIN = 10;

export const PASSWORD_RULES = [
  `Mindestens ${PASSWORD_MIN} Zeichen`,
  "Mindestens ein Großbuchstabe",
  "Mindestens ein Kleinbuchstabe",
  "Mindestens eine Ziffer",
  "Mindestens ein Sonderzeichen",
] as const;

/** Einzelprüfungen für die Live-Anzeige im Dialog. */
export function passwordChecks(value: string) {
  return [
    { label: PASSWORD_RULES[0], ok: value.length >= PASSWORD_MIN },
    { label: PASSWORD_RULES[1], ok: /[A-ZÄÖÜ]/.test(value) },
    { label: PASSWORD_RULES[2], ok: /[a-zäöüß]/.test(value) },
    { label: PASSWORD_RULES[3], ok: /[0-9]/.test(value) },
    { label: PASSWORD_RULES[4], ok: /[^A-Za-zÄÖÜäöüß0-9]/.test(value) },
  ];
}

/** Gibt null zurück, wenn das Passwort gültig ist, sonst einen Hinweistext. */
export function checkPassword(value: string): string | null {
  if (value.length < PASSWORD_MIN) return `Das Passwort braucht mindestens ${PASSWORD_MIN} Zeichen.`;
  if (!/[A-ZÄÖÜ]/.test(value)) return "Das Passwort braucht mindestens einen Großbuchstaben.";
  if (!/[a-zäöüß]/.test(value)) return "Das Passwort braucht mindestens einen Kleinbuchstaben.";
  if (!/[0-9]/.test(value)) return "Das Passwort braucht mindestens eine Ziffer.";
  if (!/[^A-Za-zÄÖÜäöüß0-9]/.test(value)) {
    return "Das Passwort braucht mindestens ein Sonderzeichen.";
  }
  return null;
}

/** Kennzeichnet interne PIN-Adressen, die nie als E-Mail-Zugang gelten. */
export function isPinOnlyEmail(email: string | null | undefined): boolean {
  return !email || email.endsWith("@assethunt.internal");
}
