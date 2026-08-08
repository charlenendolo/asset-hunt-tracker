/**
 * Base URL used for QR codes / printed labels.
 *
 * Printed labels live on physical machines for years, so they must never
 * encode a localhost or temporary preview host. Set VITE_APP_BASE_URL to the
 * production domain; the browser origin is only a development fallback.
 */
const CONFIGURED = (import.meta.env.VITE_APP_BASE_URL as string | undefined)?.trim();

export function appBaseUrl(): string {
  if (CONFIGURED) return CONFIGURED.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** True when the current base URL must not be printed on a permanent label. */
export function isTemporaryBaseUrl(url: string = appBaseUrl()): boolean {
  if (CONFIGURED) return false;
  return /localhost|127\.0\.0\.1|id-preview--|\.lovableproject\.com/.test(url);
}

/** Stable machine route used by every QR code. */
export function machineQrUrl(machineId: string): string {
  return `${appBaseUrl()}/maschine/${machineId}`;
}
