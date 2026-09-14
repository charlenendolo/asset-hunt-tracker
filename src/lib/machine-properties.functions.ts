import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cleanPropertyName, normalizePropertyName } from "@/lib/property-name";
import { failSafely } from "@/lib/safe-error";

const propertyNames = z.array(z.string().trim().min(1).max(80)).max(30);

export const setMachineProperties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ machineId: z.string().uuid(), names: propertyNames }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { requireManager } = await import("./roles.server");
    await requireManager(context.supabase, {
      adminOnly: true,
      message: "Nur Administratoren dürfen Eigenschaften bearbeiten.",
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const unique = new Map<string, string>();
    for (const value of data.names) {
      const name = cleanPropertyName(value);
      const key = normalizePropertyName(name);
      if (key && !unique.has(key)) unique.set(key, name);
    }

    const { data: catalog, error: catalogError } = await supabaseAdmin
      .from("machine_properties")
      .select("id, name");
    if (catalogError) failSafely("Eigenschaften konnten nicht geprüft werden.", catalogError, "properties");

    const byName = new Map((catalog ?? []).map((row) => [normalizePropertyName(row.name), row]));
    const ids: string[] = [];
    for (const [key, name] of unique) {
      const existing = byName.get(key);
      if (existing) {
        ids.push(existing.id);
        continue;
      }
      const { data: created, error } = await supabaseAdmin
        .from("machine_properties")
        .insert({ name })
        .select("id")
        .single();
      if (error || !created) {
        const { data: concurrent } = await supabaseAdmin
          .from("machine_properties")
          .select("id")
          .ilike("name", name)
          .maybeSingle();
        if (!concurrent) failSafely("Eigenschaft konnte nicht gespeichert werden.", error, "properties");
        ids.push(concurrent.id);
      } else {
        ids.push(created.id);
      }
    }

    const { error: clearError } = await supabaseAdmin
      .from("machine_property_assignments")
      .delete()
      .eq("machine_id", data.machineId);
    if (clearError) failSafely("Eigenschaften konnten nicht aktualisiert werden.", clearError, "properties");

    if (ids.length > 0) {
      const { error } = await supabaseAdmin.from("machine_property_assignments").insert(
        ids.map((propertyId) => ({ machine_id: data.machineId, property_id: propertyId })),
      );
      if (error) failSafely("Eigenschaften konnten nicht zugeordnet werden.", error, "properties");
    }
    return { ok: true as const };
  });
