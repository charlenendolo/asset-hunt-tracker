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

/**
 * Erzeugt einen zufälligen Passwortvorschlag, der alle Regeln sicher erfüllt.
 * Läuft nur im Browser; verwendet die Krypto-Zufallsquelle, nie Math.random.
 */
export function suggestPassword(length = 14): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%*?+-=";
  const all = upper + lower + digits + symbols;

  const size = Math.max(PASSWORD_MIN, length);
  const bytes = new Uint32Array(size);
  crypto.getRandomValues(bytes);
  const pick = (set: string, i: number) => set[bytes[i]! % set.length]!;

  const chars = [pick(upper, 0), pick(lower, 1), pick(digits, 2), pick(symbols, 3)];
  for (let i = 4; i < size; i++) chars.push(pick(all, i));

  // Fisher-Yates mit frischer Zufallsquelle, damit die Position nicht vorhersehbar ist.
  const shuffle = new Uint32Array(chars.length);
  crypto.getRandomValues(shuffle);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffle[i]! % (i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

/** Kennzeichnet interne PIN-Adressen, die nie als E-Mail-Zugang gelten. */
export function isPinOnlyEmail(email: string | null | undefined): boolean {
  return !email || email.endsWith("@assethunt.internal");
}
