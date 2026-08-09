/**
 * Single server-side implementation of the employee PIN check.
 *
 * Used by the PIN login AND by security-relevant confirmations (e.g. machine
 * return). Same salt, same pepper, same PBKDF2 configuration, same progressive
 * lockout — there is deliberately no second PIN implementation.
 *
 * The PIN is never stored, logged or returned.
 */

export type PinCheckFailure =
  | "not_found"
  | "disabled"
  | "inactive"
  | "locked"
  | "wrong_pin";

export type PinCheckResult =
  | { ok: true; userId: string; mustChangePin: boolean }
  | { ok: false; reason: PinCheckFailure };

type Key = { select_ref: string } | { user_id: string };

export async function verifyEmployeePin(key: Key, pin: string): Promise<PinCheckResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { verifyPin, MAX_FAILED_ATTEMPTS, lockDurationMinutes, LOCK_DECAY_HOURS } = await import(
    "./pin.server"
  );

  const column = "select_ref" in key ? "select_ref" : "user_id";
  const value = "select_ref" in key ? key.select_ref : key.user_id;

  const { data: row } = await supabaseAdmin
    .from("employee_logins")
    .select("*")
    .eq(column, value)
    .maybeSingle();
  if (!row) return { ok: false, reason: "not_found" };
  if (!row.enabled) return { ok: false, reason: "disabled" };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("active")
    .eq("id", row.user_id)
    .maybeSingle();
  if (!profile?.active) return { ok: false, reason: "inactive" };

  const now = Date.now();
  if (row.locked_until && new Date(row.locked_until).getTime() > now) {
    return { ok: false, reason: "locked" };
  }

  // lock_count decays entirely after a quiet period.
  let lockCount = row.lock_count;
  if (
    lockCount > 0 &&
    row.locked_until &&
    now - new Date(row.locked_until).getTime() > LOCK_DECAY_HOURS * 3_600_000
  ) {
    lockCount = 0;
  }

  const ok = await verifyPin(pin, row.pin_salt, row.pin_hash);
  if (!ok) {
    const attempts = row.failed_attempts + 1;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      const nextLock = lockCount + 1;
      await supabaseAdmin
        .from("employee_logins")
        .update({
          failed_attempts: 0,
          lock_count: nextLock,
          locked_until: new Date(now + lockDurationMinutes(nextLock) * 60_000).toISOString(),
        })
        .eq("user_id", row.user_id);
    } else {
      await supabaseAdmin
        .from("employee_logins")
        .update({ failed_attempts: attempts, lock_count: lockCount })
        .eq("user_id", row.user_id);
    }
    return { ok: false, reason: "wrong_pin" };
  }

  await supabaseAdmin
    .from("employee_logins")
    .update({
      failed_attempts: 0,
      locked_until: null,
      lock_count: Math.max(0, lockCount - 1),
      last_success_at: new Date(now).toISOString(),
    })
    .eq("user_id", row.user_id);

  return { ok: true, userId: row.user_id as string, mustChangePin: !!row.pin_must_change };
}
