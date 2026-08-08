export const dateFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export const dateTimeFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value?: string | null): string {
  if (!value) return "–";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "–";
  return dateFmt.format(d);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "–";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "–";
  return dateTimeFmt.format(d);
}

/**
 * "Voraussichtlich benötigt bis" — Uhrzeit wird nur angezeigt, wenn beim
 * Ausleihen eine Zeit gesetzt wurde (Mitternacht = reine Datumsangabe).
 */
export function formatExpectedReturn(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  return hasTime ? `${dateTimeFmt.format(d)} Uhr` : dateFmt.format(d);
}

export function formatNumber(value?: number | null): string {
  if (value === null || value === undefined) return "–";
  return new Intl.NumberFormat("de-DE").format(value);
}

export function formatCurrency(value?: number | string | null): string {
  if (value === null || value === undefined || value === "") return "–";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "–";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

export function textOrDash(value?: string | null): string {
  return value && value.trim().length > 0 ? value : "–";
}
