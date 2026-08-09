import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isSyntheticEmail } from "@/lib/users.functions";
import { checkPassword, PASSWORD_MIN } from "@/lib/password-policy";

/**
 * Passwortverwaltung.
 *
 * Regeln: Passwörter werden ausschließlich von Supabase Auth gespeichert —
 * niemals in eigenen Tabellen, niemals im Log. Der Service-Role-Client wird
 * erst geladen, nachdem der Aufrufer über seinen eigenen (RLS-gebundenen)
 * Client verifiziert wurde. is_admin() prüft bereits role='admin' UND active.
 */

async function assertActiveAdmin(supabase: { rpc: (fn: "is_admin") => Promise<{ data: unknown }> }) {
  const { data } = await supabase.rpc("is_admin");
  if (data !== true) throw new Error("Nur aktive Administratoren dürfen Passwörter zurücksetzen.");
}

/** Kurzlebiger Publishable-Client (keine Session) für Re-Authentifizierung. */
async function publishableClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const passwordField = z
  .string()
  .min(PASSWORD_MIN)
  .max(72)
  .refine((v) => checkPassword(v) === null, { message: "Passwort erfüllt die Regeln nicht." });

/** Eigenes Passwort ändern — mit Prüfung des aktuellen Passworts. */
export const changeOwnPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ currentPassword: z.string().min(1).max(72), newPassword: passwordField })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase.auth.getUser();
    const email = me?.user?.email ?? null;
    if (!email || isSyntheticEmail(email)) {
      throw new Error("Dein Zugang nutzt den Mitarbeiter-Login. Bitte den PIN ändern.");
    }
    if (data.currentPassword === data.newPassword) {
      throw new Error("Das neue Passwort muss sich vom aktuellen unterscheiden.");
    }

    const auth = await publishableClient();
    const { error: signInError } = await auth.auth.signInWithPassword({
      email,
      password: data.currentPassword,
    });
    if (signInError) {
      throw new Error("Das aktuelle Passwort ist nicht korrekt.");
    }
    await auth.auth.signOut();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.newPassword,
    });
    if (error) {
      console.error("[password] update failed", error.message);
      throw new Error("Passwort konnte nicht geändert werden. Bitte später erneut versuchen.");
    }
    return { ok: true };
  });

/** Admin: Reset-Link an die echte E-Mail-Adresse senden (Standardweg). */
export const sendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid(), redirectTo: z.string().url().max(500) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertActiveAdmin(context.supabase as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const email = target?.user?.email ?? null;
    if (!email || isSyntheticEmail(email)) {
      throw new Error("Für diesen Zugang ist keine echte E-Mail-Adresse hinterlegt.");
    }

    const auth = await publishableClient();
    const { error } = await auth.auth.resetPasswordForEmail(email, { redirectTo: data.redirectTo });
    if (error) {
      console.error("[password] reset mail failed", error.message);
      throw new Error("Reset-Link konnte nicht versendet werden.");
    }
    return { email };
  });

/** Admin: temporäres Passwort setzen (Alternative ohne E-Mail-Versand). */
export const setTemporaryPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid(), password: passwordField }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertActiveAdmin(context.supabase as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const email = target?.user?.email ?? null;
    if (!email || isSyntheticEmail(email)) {
      throw new Error("Dieser Zugang nutzt den Mitarbeiter-Login. Bitte den PIN zurücksetzen.");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) {
      console.error("[password] temp password failed", error.message);
      throw new Error("Passwort konnte nicht gesetzt werden.");
    }
    return { ok: true };
  });
