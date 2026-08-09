/**
 * Normalisierung von Zubehörbezeichnungen (client- und serverseitig genutzt).
 * Ziel: gleiche Bezeichnung nicht mehrfach in unterschiedlichen Schreibweisen.
 * Bewusst konservativ — keine automatische Umbenennung, nur Erkennung.
 */
export function normalizeAccessoryName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue");
}

/** Sucht in bekannten Bezeichnungen die kanonische Schreibweise. */
export function canonicalAccessoryName(value: string, known: readonly string[]): string {
  const key = normalizeAccessoryName(value);
  const hit = known.find((n) => normalizeAccessoryName(n) === key);
  return hit ?? value.trim().replace(/\s+/g, " ");
}
