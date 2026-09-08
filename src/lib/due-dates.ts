/**
 * Kalendertagsbasierte Fälligkeitslogik für Prüfungen und Wartungen.
 *
 * Beide Fristen sind reine Datumsfelder (ohne Uhrzeit). Der Vergleich erfolgt
 * deshalb ausschließlich über lokale Kalenderdaten im Format YYYY-MM-DD —
 * niemals über UTC-Zeitstempel, damit ein Gerät nicht einige Stunden zu früh
 * als fällig gilt.
 *
 * - Prüfung:  machines.inspection_required + machines.next_inspection_date
 * - Wartung:  maintenance.scheduled_date + maintenance.status
 *
 * „Prüfpflichtig" und „Wartung fällig" sind abgeleitete Zustände, keine
 * gespeicherten Status.
 */

/** Vorwarnzeit für anstehende Wartungen (Kalendertage). */
export const MAINTENANCE_WARNING_DAYS = 30;

/** Lokales Kalenderdatum als YYYY-MM-DD. */
export function localISODate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Lokales Kalenderdatum in n Tagen als YYYY-MM-DD. */
export function localISODatePlusDays(days: number, from: Date = new Date()): string {
  const c = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  c.setDate(c.getDate() + days);
  return localISODate(c);
}

/** Nur den Datumsanteil (YYYY-MM-DD) eines Datums-/Zeitstempelwerts. */
function dateOnly(value?: string | null): string | null {
  if (!value) return null;
  const s = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export type DueState = "overdue" | "today" | "upcoming";

/* ------------------------------------------------------------ Prüfung */

export type InspectionLike = {
  inspection_required?: boolean | null;
  next_inspection_date?: string | null;
};

/**
 * Prüfpflichtig = Prüfung erforderlich und nächster Prüftermin heute oder in
 * der Vergangenheit. Wird eine Prüfung abgeschlossen und ein neuer, künftiger
 * Termin gesetzt, fällt das Gerät automatisch wieder heraus.
 */
export function inspectionDueState(
  machine: InspectionLike,
  today: string = localISODate(),
): Exclude<DueState, "upcoming"> | null {
  if (machine.inspection_required !== true) return null;
  const due = dateOnly(machine.next_inspection_date);
  if (!due) return null;
  if (due < today) return "overdue";
  if (due === today) return "today";
  return null;
}

export function isInspectionDue(machine: InspectionLike, today: string = localISODate()): boolean {
  return inspectionDueState(machine, today) !== null;
}

export function inspectionDueLabel(machine: InspectionLike, today: string = localISODate()): string {
  const state = inspectionDueState(machine, today);
  if (state === "today") return "Prüfung heute fällig";
  if (state === "overdue") return "Prüfung überfällig";
  return "Prüfpflichtig";
}

/* ------------------------------------------------------------ Wartung */

export type MaintenanceLike = {
  status?: string | null;
  scheduled_date?: string | null;
};

/** Offene Wartungen: alles außer abgeschlossen/storniert. */
export function isMaintenanceOpen(row: MaintenanceLike): boolean {
  return row.status !== "completed" && row.status !== "cancelled";
}

/**
 * Fälligkeitszustand einer offenen Wartung innerhalb des Vorwarnfensters:
 * überfällig (vor heute), heute fällig, demnächst (innerhalb der nächsten
 * MAINTENANCE_WARNING_DAYS Tage). Sonst null.
 */
export function maintenanceDueState(
  row: MaintenanceLike,
  today: string = localISODate(),
  windowDays: number = MAINTENANCE_WARNING_DAYS,
): DueState | null {
  if (!isMaintenanceOpen(row)) return null;
  const due = dateOnly(row.scheduled_date);
  if (!due) return null;
  if (due < today) return "overdue";
  if (due === today) return "today";
  const horizon = localISODatePlusDays(windowDays);
  return due <= horizon ? "upcoming" : null;
}

export function isMaintenanceDue(row: MaintenanceLike, today: string = localISODate()): boolean {
  return maintenanceDueState(row, today) !== null;
}

export const MAINTENANCE_DUE_LABELS: Record<DueState, string> = {
  overdue: "Überfällig",
  today: "Heute fällig",
  upcoming: "Demnächst fällig",
};

/** Anzahl unterschiedlicher Geräte mit fälliger Wartung. */
export function countMachinesWithDueMaintenance(
  rows: Array<MaintenanceLike & { machine?: { id: string } | null; machine_id?: string | null }>,
  today: string = localISODate(),
): number {
  const ids = new Set<string>();
  for (const r of rows) {
    if (!isMaintenanceDue(r, today)) continue;
    const id = r.machine?.id ?? r.machine_id ?? null;
    if (id) ids.add(id);
  }
  return ids.size;
}
