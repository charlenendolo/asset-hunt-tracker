import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSyntheticEmail } from "@/lib/users.functions";

/**
 * Verbindet Rollenwechsel mit dem passenden Login-Zugang.
 *
 * Reihenfolge ist bewusst fehlersicher: erst den neuen Zugang einrichten und
 * verifizieren, dann die Rolle setzen, erst danach den alten Zugang
 * deaktivieren. Schlägt ein Schritt fehl, bleibt der bisherige Zugang aktiv.
 * Kein Passwort und kein PIN wird jemals in eigenen Tabellen gespeichert.
 */

async function assertAdmin(supabase: { rpc: (fn: "is_admin") => Promise<{ data: unknown }> }) {
  const { data } = await supabase.rpc("is_admin");
  if (data !== true) throw new Error("Nur Administratoren dürfen Zugänge verwalten.");
}

/** Zugangsstatus eines Benutzers (nur für Admins). */
export const getAccessState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const rawEmail = authUser?.user?.email ?? null;
    const realEmail = isSyntheticEmail(rawEmail) ? null : rawEmail;

    const { data: pin } = await supabaseAdmin
      .from("employee_logins")
      .select("enabled")
      .eq("user_id", data.userId)
      .maybeSingle();

    return {
      email: realEmail,
      hasEmailLogin: !!realEmail,
      hasPinRecord: !!pin,
      pinEnabled: !!pin?.enabled,
    };
  });

const managerSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  role: z.enum(["site_manager", "admin"]),
});

/**
 * Mitarbeiter -> Bauleiter/Administrator.
 * Setzt eine echte Geschäfts-E-Mail plus Startpasswort, danach die Rolle,
 * zuletzt wird ein vorhandener PIN-Zugang deaktiviert (nicht gelöscht).
 */
export const setupManagerAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => managerSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never);
    if (isSyntheticEmail(data.email)) {
      throw new Error("Bitte eine echte geschäftliche E-Mail-Adresse verwenden.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. E-Mail-/Passwort-Zugang einrichten und bestätigen.
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      email: data.email.toLowerCase(),
      email_confirm: true,
      password: data.password,
    });
    if (authError) {
      throw new Error(
        authError.message?.includes("already")
          ? "Diese E-Mail wird bereits von einem anderen Zugang verwendet."
          : "Bauleiter-Zugang konnte nicht eingerichtet werden.",
      );
    }

    // 2. Verifizieren, dass der Zugang jetzt wirklich nutzbar ist.
    const { data: check } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const email = check?.user?.email ?? null;
    if (!email || isSyntheticEmail(email)) {
      throw new Error("Zugang konnte nicht verifiziert werden. Rolle wurde nicht geändert.");
    }

    // 3. Rolle setzen.
    const { error: roleError } = await supabaseAdmin
      .from("profiles")
      .update({ role: data.role })
      .eq("id", data.userId);
    if (roleError) throw new Error("Rolle konnte nicht gespeichert werden.");

    // 4. Erst jetzt den PIN-Zugang deaktivieren (Daten bleiben erhalten).
    await supabaseAdmin
      .from("employee_logins")
      .update({ enabled: false })
      .eq("user_id", data.userId);

    return { ok: true, email };
  });

/**
 * Bauleiter/Administrator -> Mitarbeiter.
 * Richtet den PIN-Zugang ein bzw. reaktiviert ihn und setzt danach die Rolle.
 * Der E-Mail-Zugang bleibt bestehen, damit niemand ausgesperrt wird.
 */
export const setupEmployeeAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { randomPin, randomSalt, hashPin } = await import("./pin.server");

    const pin = randomPin();
    const salt = randomSalt();
    const { error: pinError } = await supabaseAdmin.from("employee_logins").upsert(
      {
        user_id: data.userId,
        pin_hash: await hashPin(pin, salt),
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
    if (pinError) throw new Error("Mitarbeiter-Zugang konnte nicht eingerichtet werden.");

    const { error: roleError } = await supabaseAdmin
      .from("profiles")
      .update({ role: "user" })
      .eq("id", data.userId);
    if (roleError) throw new Error("Rolle konnte nicht gespeichert werden.");

    return { pin };
  });
