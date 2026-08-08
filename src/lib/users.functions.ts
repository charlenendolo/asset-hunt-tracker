import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin-only account provisioning. No schema change: the existing
 * on_auth_user_created trigger creates the profile row; we only set the role
 * afterwards. The caller's admin status is verified through their OWN client
 * (RLS-scoped is_admin()) before the service-role client is loaded.
 */

const ROLES = ["admin", "office", "manager", "user"] as const;

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

    const patch: { role?: string; active?: boolean } = {};
    if (data.role) patch.role = data.role;
    if (typeof data.active === "boolean") patch.active = data.active;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
    if (error) throw new Error("Änderung konnte nicht gespeichert werden.");
    return { ok: true };
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
