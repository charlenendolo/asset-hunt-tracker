import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * PIN login as an ADDITIONAL authentication path. It never creates a second
 * account: the PIN resolves to an existing auth user, and the Supabase session
 * is minted server-side for exactly that user, so auth.uid() === profiles.id.
 *
 * employee_logins is service-role only (no anon/authenticated grants, RLS on
 * with no policies), so every access goes through these handlers.
 */

const GENERIC = "Anmeldung nicht möglich.";

/**
 * Suche nach PIN-Mitarbeitern. Die Liste wird NIE automatisch beim Laden der
 * Login-Seite gerendert; der Client ruft diese Funktion erst ab 2 Zeichen oder
 * beim bewussten Öffnen des Dropdowns auf. Es werden ausschließlich Anzeigename
 * und ein neutraler select_ref zurückgegeben (keine E-Mail, Rolle oder ID).
 */
export const searchPinEmployees = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({ query: z.string().max(80).optional() })
      .catch({ query: "" })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rowsRaw, error } = await supabaseAdmin
      .from("employee_logins")
      .select("select_ref, profiles!inner(full_name, active)")
      .eq("enabled", true)
      .limit(500);
    if (error) return [] as { ref: string; name: string }[];

    const rows = (rowsRaw ?? [])
      .filter((row) => (row.profiles as { active: boolean } | null)?.active)
      .map((row) => ({
        ref: row.select_ref as string,
        name:
          ((row.profiles as { full_name: string | null } | null)?.full_name ?? "").trim() ||
          "Mitarbeiter",
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));

    // Neutral suffix for identical display names — no email, role or id is leaked.
    const seen = new Map<string, number>();
    const labelled = rows.map((row) => {
      const count = (seen.get(row.name) ?? 0) + 1;
      seen.set(row.name, count);
      return count > 1 ? { ...row, name: `${row.name} (${count})` } : row;
    });

    const q = (data.query ?? "").trim().toLowerCase();
    const matched = q ? labelled.filter((r) => r.name.toLowerCase().includes(q)) : labelled;
    return matched.slice(0, 10);
  });


const loginSchema = z.object({
  ref: z.string().uuid(),
  pin: z.string().regex(/^\d{4}$/),
});

export const pinLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const parsed = loginSchema.safeParse(data);
    if (!parsed.success) throw new Error(GENERIC);
    return parsed.data;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const {
      verifyPin,
      MAX_FAILED_ATTEMPTS,
      lockDurationMinutes,
      LOCK_DECAY_HOURS,
    } = await import("./pin.server");

    const { data: row } = await supabaseAdmin
      .from("employee_logins")
      .select("*")
      .eq("select_ref", data.ref)
      .maybeSingle();
    if (!row || !row.enabled) throw new Error(GENERIC);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active")
      .eq("id", row.user_id)
      .maybeSingle();
    if (!profile?.active) throw new Error(GENERIC);

    const now = Date.now();
    if (row.locked_until && new Date(row.locked_until).getTime() > now) throw new Error(GENERIC);

    // lock_count decays entirely after a quiet period.
    let lockCount = row.lock_count;
    if (
      lockCount > 0 &&
      row.locked_until &&
      now - new Date(row.locked_until).getTime() > LOCK_DECAY_HOURS * 3_600_000
    ) {
      lockCount = 0;
    }

    const ok = await verifyPin(data.pin, row.pin_salt, row.pin_hash);
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
      throw new Error(GENERIC);
    }

    // Full server-side session exchange: the magic-link token never reaches the browser.
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
    const email = authUser?.user?.email;
    if (!email) throw new Error(GENERIC);

    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const tokenHash = link?.properties?.hashed_token;
    if (linkError || !tokenHash) throw new Error(GENERIC);

    const { createClient } = await import("@supabase/supabase-js");
    const exchange = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: verified, error: verifyError } = await exchange.auth.verifyOtp({
      type: "magiclink",
      token_hash: tokenHash,
    });
    if (verifyError || !verified.session) throw new Error(GENERIC);

    await supabaseAdmin
      .from("employee_logins")
      .update({
        failed_attempts: 0,
        locked_until: null,
        lock_count: Math.max(0, lockCount - 1),
        last_success_at: new Date(now).toISOString(),
      })
      .eq("user_id", row.user_id);

    return {
      accessToken: verified.session.access_token,
      refreshToken: verified.session.refresh_token,
      mustChangePin: row.pin_must_change,
    };
  });

const changeSchema = z.object({
  currentPin: z.string().regex(/^\d{4}$/),
  newPin: z.string().regex(/^\d{4}$/),
});

export const changeOwnPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => changeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyPin, hashPin, randomSalt, isWeakPin } = await import("./pin.server");

    if (isWeakPin(data.newPin)) {
      throw new Error("Bitte wähle einen weniger vorhersehbaren PIN.");
    }
    if (data.newPin === data.currentPin) {
      throw new Error("Der neue PIN muss sich vom bisherigen unterscheiden.");
    }

    const { data: row } = await supabaseAdmin
      .from("employee_logins")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row || !row.enabled) throw new Error(GENERIC);

    const ok = await verifyPin(data.currentPin, row.pin_salt, row.pin_hash);
    if (!ok) throw new Error(GENERIC);

    const salt = randomSalt();
    const { error } = await supabaseAdmin
      .from("employee_logins")
      .update({
        pin_salt: salt,
        pin_hash: await hashPin(data.newPin, salt),
        pin_set_at: new Date().toISOString(),
        pin_must_change: false,
        failed_attempts: 0,
        locked_until: null,
      })
      .eq("user_id", context.userId);
    if (error) throw new Error("PIN konnte nicht gespeichert werden.");

    return { ok: true };
  });

/* ---------------------------------------------------------------- admin ---- */

async function assertAdmin(supabase: { rpc: (fn: "is_admin") => Promise<{ data: unknown }> }) {
  const { data } = await supabase.rpc("is_admin");
  if (data !== true) throw new Error("Nur Administratoren dürfen PIN-Zugänge verwalten.");
}

export const listPinAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("employee_logins")
      .select("user_id, enabled, pin_must_change, locked_until");
    return data ?? [];
  });

const userSchema = z.object({ userId: z.string().uuid() });

/** Enables PIN access (or issues a fresh start PIN). Returns the PIN exactly once. */
export const enablePinAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => userSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { randomPin, randomSalt, hashPin } = await import("./pin.server");

    const pin = randomPin();
    const salt = randomSalt();
    const hash = await hashPin(pin, salt);

    const { error } = await supabaseAdmin.from("employee_logins").upsert(
      {
        user_id: data.userId,
        pin_hash: hash,
        pin_salt: salt,
        pin_set_at: new Date().toISOString(),
        pin_must_change: true,
        failed_attempts: 0,
        lock_count: 0,
        locked_until: null,
        enabled: true,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error("PIN-Zugang konnte nicht eingerichtet werden.");

    return { pin };
  });

export const disablePinAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => userSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("employee_logins")
      .update({ enabled: false })
      .eq("user_id", data.userId);
    if (error) throw new Error("PIN-Zugang konnte nicht deaktiviert werden.");
    return { ok: true };
  });

export const unlockPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => userSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("employee_logins")
      .update({ locked_until: null, failed_attempts: 0, lock_count: 0 })
      .eq("user_id", data.userId);
    if (error) throw new Error("Sperre konnte nicht aufgehoben werden.");
    return { ok: true };
  });

/** Reset: issues a fresh start PIN, clears the lockout, forces a change. */
export const resetPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => userSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { randomPin, randomSalt, hashPin } = await import("./pin.server");

    const pin = randomPin();
    const salt = randomSalt();
    const { error } = await supabaseAdmin
      .from("employee_logins")
      .update({
        pin_hash: await hashPin(pin, salt),
        pin_salt: salt,
        pin_set_at: new Date().toISOString(),
        pin_must_change: true,
        failed_attempts: 0,
        lock_count: 0,
        locked_until: null,
        enabled: true,
      })
      .eq("user_id", data.userId);
    if (error) throw new Error("PIN konnte nicht zurückgesetzt werden.");

    return { pin };
  });
