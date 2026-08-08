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

const createSchema = z.object({
  email: z.string().trim().email().max(255),
  fullName: z.string().trim().min(2).max(120),
  password: z.string().min(8).max(72),
  role: z.enum(ROLES),
});

export const createEmployeeAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
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

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.fullName, role: data.role, active: true })
      .eq("id", created.user.id);
    if (profileError) throw new Error("Profil konnte nicht aktualisiert werden.");

    return { id: created.user.id };
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
