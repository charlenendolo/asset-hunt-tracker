import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { failSafely } from "@/lib/safe-error";

const propertyNames = z.array(z.string().trim().min(1).max(80)).max(30);

export const setMachineProperties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ machineId: z.string().uuid(), names: propertyNames }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { requireDeviceManager } = await import("./roles.server");
    await requireDeviceManager(context.supabase, "Du darfst keine Eigenschaften bearbeiten.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { replaceMachineProperties } = await import("./machine-properties.server");
    try {
      await replaceMachineProperties(supabaseAdmin, data.machineId, data.names);
    } catch (error) {
      failSafely("Eigenschaften konnten nicht aktualisiert werden.", error, "properties");
    }
    return { ok: true as const };
  });
