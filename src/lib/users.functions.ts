import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin-only account provisioning. No schema change: the existing
 * on_auth_user_created trigger creates the profile row; we only set the role
 * afterwards. The caller's admin status is verified through their OWN client
 * (RLS-scoped is_admin()) before the service-role client is loaded.
 */

// Erlaubte Rollenwerte laut DB-Constraint profiles_role_check.
const ROLES = ["admin", "site_manager", "user"] as const;

async function assertAdmin(supabase: { rpc: (fn: "is_admin") => Promise<{ data: unknown }> }) {
  const { data } = await supabase.rpc("is_admin");
  if (data !== true) throw new Error("Nur Administratoren dürfen Zugänge verwalten.");
}

/** Technical, never-delivered domain for PIN-only staff without a real address. */
const INTERNAL_EMAIL_DOMAIN = "assethunt.internal";

export function isSyntheticEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${INTERNAL_EMAIL_DOMAIN}`);
}

const createSchema = z.object({
  email: z.union([z.string().trim().email().max(255), z.literal("")]).optional(),
  fullName: z.string().trim().min(2).max(120),
  password: z.string().min(8).max(72),
  role: z.enum(ROLES),
  withPin: z.boolean().optional(),
});

export const createEmployeeAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const realEmail = data.email?.trim() ? data.email.trim() : null;
    // Placeholder is replaced by the stable pin+<auth uuid> address right after creation.
    const email = realEmail ?? `pin+${crypto.randomUUID()}@${INTERNAL_EMAIL_DOMAIN}`;

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) {
      throw new Error(
        error?.message?.includes("already")
          ? "Für diese E-Mail existiert bereits ein Zugang."
          : "Zugang konnte nicht angelegt werden.",
      );
    }

    // Same identity — only the technical address is normalised to the auth id.
    if (!realEmail) {
      await supabaseAdmin.auth.admin.updateUserById(created.user.id, {
        email: `pin+${created.user.id}@${INTERNAL_EMAIL_DOMAIN}`,
        email_confirm: true,
      });
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.fullName, role: data.role, active: true })
      .eq("id", created.user.id);
    if (profileError) throw new Error("Profil konnte nicht aktualisiert werden.");

    let pin: string | null = null;
    if (data.withPin) {
      const { randomPin, randomSalt, hashPin } = await import("./pin.server");
      pin = randomPin();
      const salt = randomSalt();
      const { error: pinError } = await supabaseAdmin.from("employee_logins").upsert(
        {
          user_id: created.user.id,
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
      if (pinError) throw new Error("PIN-Zugang konnte nicht eingerichtet werden.");
    }

    return { id: created.user.id, pin, hasEmail: !!realEmail };
  });

/** Admin-only: real contact addresses; synthetic internal ones are never returned. */
export const listAccountEmails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return [] as { id: string; email: string | null }[];

    return (data.users ?? []).map((u) => ({
      id: u.id,
      email: isSyntheticEmail(u.email) ? null : (u.email ?? null),
    }));
  });


const updateSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.union([z.string().trim().email().max(255), z.literal("")]).optional(),
});

export const updateEmployeeAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never);
    if (data.userId === context.userId && data.active === false) {
      throw new Error("Du kannst deinen eigenen Zugang nicht deaktivieren.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: { role?: string; active?: boolean; full_name?: string } = {};
    if (data.role) patch.role = data.role;
    if (typeof data.active === "boolean") patch.active = data.active;
    if (data.fullName) patch.full_name = data.fullName;

    // Lockout-Schutz: es muss immer mindestens ein aktiver Administrator bleiben.
    const losesAdmin = (data.role && data.role !== "admin") || data.active === false;
    if (losesAdmin) {
      const { data: target } = await supabaseAdmin
        .from("profiles")
        .select("role, active")
        .eq("id", data.userId)
        .maybeSingle();
      if (target?.role === "admin" && target.active) {
        const { count } = await supabaseAdmin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "admin")
          .eq("active", true);
        if ((count ?? 0) <= 1) {
          throw new Error("Mindestens ein aktiver Administrator muss bestehen bleiben.");
        }
      }
    }

    // E-Mail bleibt zwischen Auth und Anwendung konsistent: die Adresse lebt
    // ausschließlich in Supabase Auth, das Profil speichert keine Kopie.
    if (typeof data.email === "string") {
      const nextEmail = data.email.trim().toLowerCase();
      if (nextEmail && isSyntheticEmail(nextEmail)) {
        throw new Error("Bitte eine echte geschäftliche E-Mail-Adresse verwenden.");
      }
      const { data: current } = await supabaseAdmin.auth.admin.getUserById(data.userId);
      const currentEmail = (current?.user?.email ?? "").toLowerCase();
      if (nextEmail && nextEmail !== currentEmail) {
        const { error: mailError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
          email: nextEmail,
          email_confirm: true,
        });
        if (mailError) {
          throw new Error(
            mailError.message?.includes("already")
              ? "Diese E-Mail wird bereits von einem anderen Zugang verwendet."
              : "E-Mail konnte nicht geändert werden.",
          );
        }
      }
    }

    if (Object.keys(patch).length === 0) return { ok: true, sessionsRevoked: false };

    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
    if (error) {
      console.error("[users] profile update failed", {
        userId: data.userId,
        patch,
        message: error.message,
        code: error.code,
      });
      throw new Error("Änderung konnte nicht gespeichert werden: " + error.message);
    }

    // Deaktivierung und Rollenwechsel dürfen nicht durch eine noch offene
    // Sitzung ausgehebelt werden: alle Sitzungen werden beendet.
    let sessionsRevoked = false;
    if (data.active === false || (data.role && data.userId !== context.userId)) {
      const { revokeAllSessions } = await import("./auth-admin.server");
      sessionsRevoked = await revokeAllSessions(data.userId);
    }
    console.info("[audit] user updated", {
      by: context.userId,
      target: data.userId,
      fields: Object.keys(patch),
      emailChanged: typeof data.email === "string",
      sessionsRevoked,
      at: new Date().toISOString(),
    });
    return { ok: true, sessionsRevoked };
  });

/** Prüft vor dem Löschen: Geräte in Obhut und aktive Reservierungen. */
export const getDeletionCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: machines } = await supabaseAdmin
      .from("machines")
      .select("id, name, asset_code")
      .eq("responsible_user_id", data.userId);

    const { data: reservations } = await supabaseAdmin
      .from("reservations")
      .select("id, start_at, end_at, machine_id, machines(name)")
      .eq("reserved_by", data.userId)
      .eq("status", "confirmed")
      .gte("end_at", new Date().toISOString());

    return {
      isSelf: data.userId === context.userId,
      machines: (machines ?? []).map((m) => ({
        id: m.id,
        label: `${m.name}${m.asset_code ? ` (${m.asset_code})` : ""}`,
      })),
      reservations: (reservations ?? []).map((r) => ({
        id: r.id,
        label: (r.machines as { name?: string } | null)?.name ?? "Gerät",
        start_at: r.start_at,
        end_at: r.end_at,
      })),
    };
  });

/**
 * „Benutzer löschen“ = sicheres Archivieren.
 * Historie (Bewegungen, Defekte, Reservierungen) bleibt vollständig erhalten,
 * der Zugang wird jedoch endgültig unbrauchbar: Profil inaktiv, PIN aus,
 * E-Mail auf eine interne Archivadresse, Passwort zufällig, Sitzungen beendet.
 */
export const deleteEmployeeAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid(), cancelReservations: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never);
    if (data.userId === context.userId) {
      throw new Error("Du kannst deinen eigenen Zugang nicht löschen.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("full_name, role, active")
      .eq("id", data.userId)
      .maybeSingle();
    if (!target) throw new Error("Benutzer wurde nicht gefunden.");

    if (target.role === "admin" && target.active) {
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("active", true);
      if ((count ?? 0) <= 1) {
        throw new Error("Mindestens ein aktiver Administrator muss bestehen bleiben.");
      }
    }

    const { data: machines } = await supabaseAdmin
      .from("machines")
      .select("id, name, asset_code")
      .eq("responsible_user_id", data.userId);
    if ((machines ?? []).length > 0) {
      const list = (machines ?? []).map((m) => m.name).join(", ");
      throw new Error(
        `Diese Person hat noch ${machines!.length} Gerät(e) ausgeliehen: ${list}. Bitte zuerst zurückgeben oder die Zuordnung klären.`,
      );
    }

    const { data: reservations } = await supabaseAdmin
      .from("reservations")
      .select("id")
      .eq("reserved_by", data.userId)
      .eq("status", "confirmed")
      .gte("end_at", new Date().toISOString());
    if ((reservations ?? []).length > 0) {
      if (!data.cancelReservations) {
        throw new Error(
          `Diese Person hat noch ${reservations!.length} aktive Reservierung(en). Bitte zuerst stornieren.`,
        );
      }
      await supabaseAdmin
        .from("reservations")
        .update({ status: "cancelled" })
        .in(
          "id",
          (reservations ?? []).map((r) => r.id),
        );
    }

    // Zugang unbrauchbar machen — der Datensatz bleibt für die Historie erhalten.
    const { randomLockPassword, revokeAllSessions } = await import("./auth-admin.server");
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      email: `deleted+${data.userId}@assethunt.internal`,
      email_confirm: true,
      password: randomLockPassword(),
      ban_duration: "876000h",
    });
    if (authError) {
      console.error("[users] archive auth failed", authError.message);
      throw new Error("Zugang konnte nicht entfernt werden.");
    }

    await supabaseAdmin
      .from("employee_logins")
      .update({ enabled: false, locked_until: null, failed_attempts: 0 })
      .eq("user_id", data.userId);

    const name = (target.full_name ?? "Benutzer").replace(/^\(gelöscht\)\s*/, "");
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ active: false, full_name: `(gelöscht) ${name}` })
      .eq("id", data.userId);
    if (profileError) throw new Error("Profil konnte nicht archiviert werden.");

    const sessionsRevoked = await revokeAllSessions(data.userId);
    console.info("[audit] user deleted (archived)", {
      by: context.userId,
      target: data.userId,
      sessionsRevoked,
      at: new Date().toISOString(),
    });
    return { ok: true, sessionsRevoked };
  });


/**
 * Profile directory. Role and active status are privileged columns
 * (revoked from `authenticated` at the grant level), so only verified
 * admins receive them; everyone else gets the name directory only.
 */
export const listProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");

    if (isAdmin !== true) {
      const { data, error } = await context.supabase
        .from("profiles")
        .select("id, full_name, created_at")
        .order("full_name");
      if (error) throw new Error("Benutzer konnten nicht geladen werden.");
      return (data ?? []).map((p) => ({
        ...p,
        role: null as string | null,
        active: null as boolean | null,
      }));
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, role, active, created_at")
      .order("full_name");
    if (error) throw new Error("Benutzer konnten nicht geladen werden.");
    return (data ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      created_at: p.created_at,
      role: p.role as string | null,
      active: p.active as boolean | null,
    }));
  });
