import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { looksLikeEmail, normalizeUsername } from "@/lib/username";

/**
 * Einheitliche Anmeldung mit Benutzername ODER E-Mail + Passwort.
 *
 * - Supabase Auth bleibt die einzige Passwortquelle (kein eigener Speicher).
 * - Der Benutzername wird ausschließlich serverseitig aufgelöst; der Browser
 *   erhält niemals eine Zuordnung Benutzername -> E-Mail.
 * - Jeder Fehlerfall liefert dieselbe generische Meldung (keine Enumeration).
 */

const GENERIC = "Benutzername/E-Mail oder Passwort ist falsch.";
const INACTIVE = "Dieser Zugang ist derzeit nicht aktiv. Bitte wende dich an die Verwaltung.";

const schema = z.object({
  identifier: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(72),
});

/** Kurzlebiger Publishable-Client ohne Session — nur zum Prüfen der Zugangsdaten. */
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

export const passwordLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new Error(GENERIC);
    return parsed.data;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let email: string | null = null;

    if (looksLikeEmail(data.identifier)) {
      email = data.identifier.trim().toLowerCase();
    } else {
      const username = normalizeUsername(data.identifier);
      // Nur exakte Treffer, keine Suche, keine Liste — reine Auflösung.
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, active")
        .eq("username", username)
        .maybeSingle();
      if (!profile) throw new Error(GENERIC);
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.id);
      email = authUser?.user?.email ?? null;
      if (!email) throw new Error(GENERIC);
    }

    const auth = await publishableClient();
    const { data: signedIn, error } = await auth.auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (error || !signedIn.session || !signedIn.user) throw new Error(GENERIC);

    // Deaktivierte Zugänge dürfen niemals mit einem alten Passwort durchkommen.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active")
      .eq("id", signedIn.user.id)
      .maybeSingle();
    if (!profile || profile.active === false) {
      await auth.auth.signOut();
      throw new Error(INACTIVE);
    }

    return {
      accessToken: signedIn.session.access_token,
      refreshToken: signedIn.session.refresh_token,
    };
  });
