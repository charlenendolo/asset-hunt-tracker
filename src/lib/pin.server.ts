/**
 * Server-only PIN helpers. Never imported from client code (filename-blocked).
 *
 * A 4-digit PIN has low entropy, so three things carry the security:
 *   1. PBKDF2-SHA256 with a high iteration count
 *   2. a per-user random salt stored next to the hash
 *   3. a server-side pepper (PIN_PEPPER) that is NOT in the database
 * Plus a progressive server-side lockout (see lockDurationMinutes).
 */

const ITERATIONS = 210_000;
const KEY_LENGTH = 32;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomSalt(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const pepper = process.env["PIN_PEPPER"];
  if (!pepper) throw new Error("PIN_PEPPER fehlt.");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${pin}:${pepper}`),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    key,
    KEY_LENGTH * 8,
  );
  return toHex(bits);
}

/** Constant-time comparison of two hex strings. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPin(pin: string, salt: string, hash: string): Promise<boolean> {
  return timingSafeEqualHex(await hashPin(pin, salt), hash);
}

/** Rejects only obviously predictable PINs — no password-style complexity rules. */
export function isWeakPin(pin: string): boolean {
  if (!/^\d{4}$/.test(pin)) return true;
  if (/^(\d)\1{3}$/.test(pin)) return true; // 0000, 1111 ...

  const digits = pin.split("").map(Number) as number[];
  const ascending = digits.every((d, i) => i === 0 || d === (digits[i - 1]! + 1) % 10);
  const descending = digits.every((d, i) => i === 0 || d === (digits[i - 1]! + 9) % 10);
  return ascending || descending;
}

export function randomPin(): string {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const bytes = crypto.getRandomValues(new Uint32Array(4));
    const pin = Array.from(bytes, (b) => b % 10).join("");
    if (!isWeakPin(pin)) return pin;
  }
  return "4829";
}

export const MAX_FAILED_ATTEMPTS = 5;

/** Progressive lockout: 15 / 30 / 60 minutes, capped. */
export function lockDurationMinutes(lockCount: number): number {
  if (lockCount <= 1) return 15;
  if (lockCount === 2) return 30;
  return 60;
}

/** lock_count decays completely after a day without a new lock. */
export const LOCK_DECAY_HOURS = 24;
