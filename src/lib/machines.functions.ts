import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Anlage und administrative Korrekturen an Maschinen.
 * Die bestehende RLS-Policy "Admins manage machines" erlaubt INSERT/UPDATE nur
 * Administratoren. Damit auch Bauleiter Geräte erfassen dürfen, läuft der
 * Vorgang — wie Ausleihe/Rückgabe — serverseitig mit vorheriger Rollenprüfung.
 * Kein Schema- oder Policy-Eingriff.
 */

const MACHINE_STATUS = [
  "available",
  "checked_out",
  "reserved",
  "maintenance",
  "defective",
  "retired",
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const createSchema = z.object({
  assetCode: z.string().trim().min(1).max(60),
  name: z.string().trim().min(2).max(160),
  categoryId: z.string().uuid().nullable().optional(),
  manufacturer: optionalText(120),
  model: optionalText(120),
  serialNumber: optionalText(120),
  companyInventoryNumber: optionalText(120),
  siteId: z.string().uuid().nullable().optional(),
  status: z.enum(MACHINE_STATUS).default("available"),
  description: optionalText(2000),
  inspectionRequired: z.boolean().default(false),
  lastInspectionDate: optionalDate,
  nextInspectionDate: optionalDate,
  purchaseDate: optionalDate,
  purchasePrice: z.number().nonnegative().nullable().optional(),
});

export const createMachine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { requireManager } = await import("./roles.server");
    await requireManager(context.supabase, {
      message: "Nur Administratoren und Bauleiter dürfen Geräte anlegen.",
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const assetCode = data.assetCode.trim();
    const { data: existing } = await supabaseAdmin
      .from("machines")
      .select("id")
      .eq("asset_code", assetCode)
      .maybeSingle();
    if (existing) throw new Error("Diese Gerätenummer ist bereits vergeben.");

    const { data: inserted, error } = await supabaseAdmin
      .from("machines")
      .insert({
        asset_code: assetCode,
        name: data.name.trim(),
        category_id: data.categoryId ?? null,
        manufacturer: data.manufacturer,
        model: data.model,
        serial_number: data.serialNumber,
        company_inventory_number: data.companyInventoryNumber,
        current_site_id: data.siteId ?? null,
        status: data.status,
        description: data.description,
        inspection_required: data.inspectionRequired,
        last_inspection_date: data.lastInspectionDate,
        next_inspection_date: data.nextInspectionDate,
        purchase_date: data.purchaseDate,
        purchase_price: data.purchasePrice ?? null,
        active: true,
      })
      .select("id, name, asset_code")
      .single();
    if (error) throw new Error("Maschine konnte nicht angelegt werden: " + error.message);

    return inserted;
  });

const reassignSchema = z.object({
  machineId: z.string().uuid(),
  responsibleUserId: z.string().uuid().nullable(),
  comment: z.string().trim().max(2000).nullable().optional(),
});

/**
 * Administrative Korrektur der Verantwortlichkeit.
 * Historie bleibt erhalten: jede Änderung schreibt eine Bewegung vom Typ
 * "assignment" (im bestehenden CHECK-Constraint enthalten). Der alte
 * Verantwortliche steht im Kommentar, der neue in responsible_user_id.
 */
export const reassignMachineResponsibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => reassignSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { requireManager } = await import("./roles.server");
    await requireManager(context.supabase, {
      adminOnly: true,
      message: "Nur Administratoren dürfen die Verantwortlichkeit ändern.",
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: machine, error: readError } = await supabaseAdmin
      .from("machines")
      .select("id, status, current_site_id, responsible_user_id")
      .eq("id", data.machineId)
      .maybeSingle();
    if (readError || !machine) throw new Error("Gerät konnte nicht geladen werden.");

    const previousId = machine.responsible_user_id;
    if (previousId === data.responsibleUserId) {
      throw new Error("Diese Person ist bereits verantwortlich.");
    }

    const names = new Map<string, string>();
    const ids = [previousId, data.responsibleUserId].filter(Boolean) as string[];
    if (ids.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      for (const p of profiles ?? []) names.set(p.id, p.full_name ?? "Unbekannt");
    }

    const { error: updateError } = await supabaseAdmin
      .from("machines")
      .update({ responsible_user_id: data.responsibleUserId })
      .eq("id", machine.id)
      .eq("responsible_user_id", previousId as never)
      .select("id")
      .maybeSingle();
    // Wenn zuvor niemand verantwortlich war, greift der eq-Filter nicht.
    if (updateError) throw new Error("Änderung fehlgeschlagen: " + updateError.message);
    if (previousId === null) {
      const { error: nullUpdateError } = await supabaseAdmin
        .from("machines")
        .update({ responsible_user_id: data.responsibleUserId })
        .eq("id", machine.id)
        .is("responsible_user_id", null);
      if (nullUpdateError) throw new Error("Änderung fehlgeschlagen: " + nullUpdateError.message);
    }

    const from = previousId ? names.get(previousId) : null;
    const to = data.responsibleUserId ? names.get(data.responsibleUserId) : null;
    const trail = `Verantwortlichkeit: ${from ?? "niemand"} → ${to ?? "niemand"} (administrative Korrektur)`;

    const { error: movementError } = await supabaseAdmin.from("movements").insert({
      machine_id: machine.id,
      movement_type: "assignment",
      performed_by: context.userId,
      responsible_user_id: data.responsibleUserId,
      from_site_id: machine.current_site_id,
      to_site_id: machine.current_site_id,
      comment: data.comment ? `${trail} · ${data.comment}` : trail,
    });
    if (movementError) {
      await supabaseAdmin
        .from("machines")
        .update({ responsible_user_id: previousId })
        .eq("id", machine.id);
      throw new Error("Änderung konnte nicht protokolliert werden. Vorgang abgebrochen.");
    }

    return { ok: true as const };
  });
