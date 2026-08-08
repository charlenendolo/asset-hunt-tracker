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
