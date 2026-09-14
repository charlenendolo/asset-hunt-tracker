import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { failSafely } from "@/lib/safe-error";

/**
 * Zubehörverwaltung. Die bestehende RLS-Policy "Admins manage accessories"
 * erlaubt Writes nur Administratoren — damit auch Bauleiter Zubehör pflegen
 * dürfen, läuft der Vorgang serverseitig mit vorheriger Rollenprüfung
 * (bestehendes AssetHunt-Muster). Kein Schema- oder Policy-Eingriff.
 */

export const accessoryInput = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.number().int().min(1).max(999).default(1),
  required: z.boolean().default(true),
});

const addSchema = z.object({
  machineId: z.string().uuid(),
  items: z.array(accessoryInput).min(1).max(50),
});

export const addMachineAccessories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => addSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { requireDeviceManager } = await import("./roles.server");
    await requireDeviceManager(context.supabase, "Du darfst kein Zubehör pflegen.");
    const { insertAccessories } = await import("./accessories.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return insertAccessories(supabaseAdmin, data.machineId, data.items);
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
  required: z.boolean(),
});

export const updateMachineAccessory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { requireDeviceManager } = await import("./roles.server");
    await requireDeviceManager(context.supabase, "Du darfst kein Zubehör pflegen.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("accessories")
      .update({ quantity: data.quantity, required: data.required })
      .eq("id", data.id);
    if (error) failSafely("Zubehör konnte nicht geändert werden.", error, "accessories");
    return { ok: true as const };
  });

export const deleteMachineAccessory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { requireDeviceManager } = await import("./roles.server");
    await requireDeviceManager(context.supabase, "Du darfst kein Zubehör entfernen.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("accessories").delete().eq("id", data.id);
    if (error) failSafely("Zubehör konnte nicht entfernt werden.", error, "accessories");
    return { ok: true as const };
  });
