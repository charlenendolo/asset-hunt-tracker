export type StatusKey =
  | "available"
  | "reserved"
  | "borrowed"
  | "maintenance"
  | "defect"
  | "unknown";

const MACHINE_STATUS_ALIASES: Record<string, StatusKey> = {
  available: "available",
  verfuegbar: "available",
  verfügbar: "available",
  frei: "available",
  reserved: "reserved",
  reserviert: "reserved",
  borrowed: "borrowed",
  ausgeliehen: "borrowed",
  in_use: "borrowed",
  checked_out: "borrowed",
  maintenance: "maintenance",
  wartung: "maintenance",
  service: "maintenance",
  defect: "defect",
  defective: "defect",
  defekt: "defect",
  broken: "defect",
};

export const MACHINE_STATUS_LABELS: Record<StatusKey, string> = {
  available: "Verfügbar",
  reserved: "Reserviert",
  borrowed: "Ausgeliehen",
  maintenance: "Wartung",
  defect: "Defekt",
  unknown: "Unbekannt",
};

export const MACHINE_STATUS_ORDER: StatusKey[] = [
  "available",
  "reserved",
  "borrowed",
  "maintenance",
  "defect",
];

/** Raw DB values we filter by, keyed by our normalised status key. */
export const MACHINE_STATUS_DB_VALUES: Record<string, string> = {
  available: "available",
  reserved: "reserved",
  borrowed: "borrowed",
  maintenance: "maintenance",
  defect: "defect",
};

export function machineStatusKey(raw?: string | null): StatusKey {
  if (!raw) return "unknown";
  return MACHINE_STATUS_ALIASES[raw.toLowerCase().trim()] ?? "unknown";
}

export function machineStatusLabel(raw?: string | null): string {
  const key = machineStatusKey(raw);
  return key === "unknown" ? (raw ?? "Unbekannt") : MACHINE_STATUS_LABELS[key];
}

export const DEFECT_STATUS_LABELS: Record<string, string> = {
  open: "Offen",
  in_progress: "In Bearbeitung",
  resolved: "Behoben",
  closed: "Geschlossen",
};

export const DEFECT_SEVERITY_LABELS: Record<string, string> = {
  low: "Gering",
  normal: "Normal",
  high: "Hoch",
  critical: "Kritisch",
};

export const MAINTENANCE_STATUS_LABELS: Record<string, string> = {
  scheduled: "Geplant",
  in_progress: "In Bearbeitung",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
};

export const RESERVATION_STATUS_LABELS: Record<string, string> = {
  confirmed: "Bestätigt",
  pending: "Ausstehend",
  cancelled: "Storniert",
  completed: "Abgeschlossen",
};

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  checkout: "Ausleihe",
  checkin: "Rückgabe",
  return: "Rückgabe",
  transfer: "Umlagerung",
  assignment: "Zuordnung",
  maintenance_out: "Zur Wartung",
  maintenance_return: "Aus Wartung zurück",
};

/** Free-text condition values we write from the return flow. */
export const CONDITION_LABELS: Record<string, string> = {
  ok: "In Ordnung",
  minor_issue: "Kleiner Mangel",
  damaged: "Beschädigt",
};

/** All raw DB values that map to one normalised status key. */
export function machineStatusDbValues(key: string): string[] {
  return Object.entries(MACHINE_STATUS_ALIASES)
    .filter(([, v]) => v === key)
    .map(([raw]) => raw);
}


export function labelFor(map: Record<string, string>, raw?: string | null): string {
  if (!raw) return "–";
  return map[raw.toLowerCase()] ?? raw;
}
