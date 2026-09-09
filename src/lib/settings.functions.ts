import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { failSafely } from "@/lib/safe-error";
import { DEFAULT_INSPECTION_WARNING_DAYS } from "@/lib/due-dates";

/**
 * Anwendungsweite Einstellungen (public.app_settings).
 * Lesen: jede angemeldete Person (RLS-Select-Policy).
 * Schreiben: ausschließlich Administratoren, serverseitig geprüft.
 */

export const INSPECTION_WARNING_DAYS_KEY = "inspection_warning_days";

const MIN_DAYS = 0;
const MAX_DAYS = 365;

function normaliseDays(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_INSPECTION_WARNING_DAYS;
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(n)));
}

export const getInspectionWarningDays = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("app_settings")
      .select("value")
      .eq("key", INSPECTION_WARNING_DAYS_KEY)
      .maybeSingle();
    if (error) return { days: DEFAULT_INSPECTION_WARNING_DAYS };
    return { days: data ? normaliseDays(data.value) : DEFAULT_INSPECTION_WARNING_DAYS };
  });

const setSchema = z.object({ days: z.number().int().min(MIN_DAYS).max(MAX_DAYS) });

export const setInspectionWarningDays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => setSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { requireManager } = await import("./roles.server");
    await requireManager(context.supabase, {
      adminOnly: true,
      message: "Nur Administratoren dürfen diese Einstellung ändern.",
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert(
        { key: INSPECTION_WARNING_DAYS_KEY, value: data.days as unknown as never },
        { onConflict: "key" },
      );
    if (error) failSafely("Einstellung konnte nicht gespeichert werden.", error, "settings");

    return { days: data.days };
  });
