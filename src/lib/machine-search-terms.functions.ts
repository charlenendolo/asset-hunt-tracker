import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { failSafely } from "@/lib/safe-error";

const termNames = z.array(z.string().trim().min(1).max(80)).max(30);

/** Alternative Suchbegriffe pflegen — nur Geräteverwaltung. */
export const setMachineSearchTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ machineId: z.string().uuid(), names: termNames }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { requireDeviceManager } = await import("./roles.server");
    await requireDeviceManager(context.supabase, "Du darfst keine Suchbegriffe bearbeiten.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { replaceMachineSearchTerms } = await import("./machine-search-terms.server");
    try {
      await replaceMachineSearchTerms(supabaseAdmin, data.machineId, data.names);
    } catch (error) {
      failSafely("Suchbegriffe konnten nicht aktualisiert werden.", error, "search-terms");
    }
    return { ok: true as const };
  });
