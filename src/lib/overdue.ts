import { machineStatusKey } from "@/lib/status";

/**
 * „Überfällig" ist ein rein abgeleiteter Zustand — kein Datenbankstatus.
 * Grundlage: machines.status = 'checked_out' (Statusschlüssel "borrowed")
 * plus ein in der Vergangenheit liegendes expected_return_at.
 * Alle Zeitpunkte werden als ISO-Zeitstempel (UTC) gelesen und lokal verglichen.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export type OverdueLike = {
  status?: string | null;
  expected_return_at?: string | null;
};

export function isOverdue(machine: OverdueLike, now: number = Date.now()): boolean {
  if (machineStatusKey(machine.status) !== "borrowed") return false;
  if (!machine.expected_return_at) return false;
  const due = new Date(machine.expected_return_at).getTime();
  if (Number.isNaN(due)) return false;
  return due < now;
}

/** Volle Tage seit der Fälligkeit (0 = heute fällig geworden). */
export function overdueDays(expectedReturnAt?: string | null, now: number = Date.now()): number {
  if (!expectedReturnAt) return 0;
  const due = new Date(expectedReturnAt).getTime();
  if (Number.isNaN(due) || due >= now) return 0;
  return Math.floor((now - due) / DAY_MS);
}

/** „Überfällig seit 3 Tagen" bzw. „Überfällig seit heute". */
export function overdueLabel(expectedReturnAt?: string | null, now: number = Date.now()): string {
  const days = overdueDays(expectedReturnAt, now);
  if (days <= 0) return "Überfällig seit heute";
  return `Überfällig seit ${days} ${days === 1 ? "Tag" : "Tagen"}`;
}

/** Kurzform für dichte Listen: „seit 3 Tagen". */
export function overdueSinceShort(
  expectedReturnAt?: string | null,
  now: number = Date.now(),
): string {
  const days = overdueDays(expectedReturnAt, now);
  if (days <= 0) return "seit heute";
  return `seit ${days} ${days === 1 ? "Tag" : "Tagen"}`;
}
