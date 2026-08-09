/** Standorttypen — Werte entsprechen sites.location_type (CHECK-Constraint). */
export const SITE_TYPE_ORDER = [
  "baustelle",
  "fahrzeug",
  "lager",
  "werkstatt",
  "sonstiges",
] as const;

export type SiteType = (typeof SITE_TYPE_ORDER)[number];

export const SITE_TYPE_LABELS: Record<SiteType, string> = {
  baustelle: "Baustelle",
  fahrzeug: "Fahrzeug",
  lager: "Lager",
  werkstatt: "Werkstatt",
  sonstiges: "Sonstiger Standort",
};

export function siteTypeLabel(value: string | null | undefined): string {
  if (!value) return "Standort";
  return SITE_TYPE_LABELS[value as SiteType] ?? "Standort";
}

export function isSiteType(value: string): value is SiteType {
  return (SITE_TYPE_ORDER as readonly string[]).includes(value);
}
