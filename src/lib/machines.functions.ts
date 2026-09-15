import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { failSafely } from "@/lib/safe-error";

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
  properties: z.array(z.string().trim().min(1).max(80)).max(30).optional().default([]),
  accessories: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        quantity: z.number().int().min(1).max(999).default(1),
        required: z.boolean().default(true),
      }),
    )
    .max(50)
    .optional()
    .default([]),
});

export const createMachine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { requireDeviceManager } = await import("./roles.server");
    await requireDeviceManager(
      context.supabase,
      "Nur Administratoren, Bauleiter und Lagerverwalter dürfen Geräte anlegen.",
    );
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
    if (error) failSafely("Maschine konnte nicht angelegt werden.", error, "machines");

    // Zubehör gehört zur Anlage: schlägt es fehl, wird die Maschine wieder
    // entfernt, damit kein unbemerkter Teilzustand entsteht.
    if (data.accessories.length > 0) {
      const { insertAccessories } = await import("./accessories.server");
      try {
        await insertAccessories(supabaseAdmin, inserted.id, data.accessories);
      } catch (accessoryError) {
        await supabaseAdmin.from("accessories").delete().eq("machine_id", inserted.id);
        await supabaseAdmin.from("machines").delete().eq("id", inserted.id);
        throw new Error(
          "Maschine wurde nicht angelegt, weil das Zubehör nicht gespeichert werden konnte: " +
            (accessoryError as Error).message,
        );
      }
    }

    if (data.properties.length > 0) {
      const { replaceMachineProperties } = await import("./machine-properties.server");
      try {
        await replaceMachineProperties(supabaseAdmin, inserted.id, data.properties);
      } catch (propertyError) {
        await supabaseAdmin.from("accessories").delete().eq("machine_id", inserted.id);
        await supabaseAdmin.from("machines").delete().eq("id", inserted.id);
        throw new Error(
          "Maschine wurde nicht angelegt, weil die Eigenschaften nicht gespeichert werden konnten: " +
            (propertyError as Error).message,
        );
      }
    }

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

    // Obhut und Status sind eine Einheit: wer ein Gerät hält, hat es
    // ausgeliehen. Defekt/Wartung bleiben als übergeordnete Zustände bestehen.
    const currentStatus = (machine.status ?? "").toLowerCase();
    const locked = currentStatus === "maintenance" || currentStatus === "defective";
    let nextStatus = currentStatus;
    if (!locked) {
      if (data.responsibleUserId) {
        nextStatus = "checked_out";
      } else {
        // Obhut endet: offene Defekte sperren weiterhin, sonst wieder verfügbar
        // (der abgeleitete Zustand „Zugewiesen" ergibt sich aus dem Standorttyp).
        const { count: openDefects } = await supabaseAdmin
          .from("defects")
          .select("id", { count: "exact", head: true })
          .eq("machine_id", machine.id)
          .neq("status", "resolved");
        nextStatus = (openDefects ?? 0) > 0 ? "defective" : "available";
      }
    }

    // Optimistischer Abgleich gegen den zuvor gelesenen Stand.
    let updateQuery = supabaseAdmin
      .from("machines")
      .update({
        responsible_user_id: data.responsibleUserId,
        status: nextStatus,
        ...(data.responsibleUserId ? {} : { expected_return_at: null }),
      })
      .eq("id", machine.id);
    updateQuery = previousId
      ? updateQuery.eq("responsible_user_id", previousId)
      : updateQuery.is("responsible_user_id", null);

    const { data: updated, error: updateError } = await updateQuery.select("id").maybeSingle();
    if (updateError) failSafely("Änderung fehlgeschlagen.", updateError, "machines");
    if (!updated) {
      throw new Error("Die Verantwortlichkeit wurde zwischenzeitlich geändert. Bitte neu laden.");
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
        .update({ responsible_user_id: previousId, status: machine.status })
        .eq("id", machine.id);
      throw new Error("Änderung konnte nicht protokolliert werden. Vorgang abgebrochen.");
    }

    return { ok: true as const };
  });

const changeSiteSchema = z.object({
  machineId: z.string().uuid(),
  siteId: z.string().uuid().nullable(),
  comment: z.string().trim().max(2000).nullable().optional(),
});

/**
 * Administrative Standortkorrektur.
 * Bewusst getrennt von Obhut und Status: „Zugewiesen" ist ein abgeleiteter
 * Zustand aus dem Standorttyp, deshalb wird der gespeicherte Status
 * (ausgeliehen, defekt, Wartung, verfügbar) niemals überschrieben.
 * Der Wechsel wird als Bewegung „transfer" protokolliert.
 */
export const changeMachineSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => changeSiteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { requireManager } = await import("./roles.server");
    await requireManager(context.supabase, {
      adminOnly: true,
      message: "Nur Administratoren dürfen den Standort ändern.",
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: machine, error: readError } = await supabaseAdmin
      .from("machines")
      .select("id, current_site_id, responsible_user_id")
      .eq("id", data.machineId)
      .maybeSingle();
    if (readError || !machine) throw new Error("Gerät konnte nicht geladen werden.");

    const previousSiteId = machine.current_site_id ?? null;
    if (previousSiteId === data.siteId) {
      throw new Error("Das Gerät befindet sich bereits an diesem Standort.");
    }

    if (data.siteId) {
      const { data: site } = await supabaseAdmin
        .from("sites")
        .select("id, active")
        .eq("id", data.siteId)
        .maybeSingle();
      if (!site) throw new Error("Standort nicht gefunden.");
      if (site.active === false) throw new Error("Dieser Standort ist nicht aktiv.");
    }

    // Optimistischer Abgleich gegen den zuvor gelesenen Stand.
    let updateQuery = supabaseAdmin
      .from("machines")
      .update({ current_site_id: data.siteId })
      .eq("id", machine.id);
    updateQuery = previousSiteId
      ? updateQuery.eq("current_site_id", previousSiteId)
      : updateQuery.is("current_site_id", null);

    const { data: updated, error: updateError } = await updateQuery.select("id").maybeSingle();
    if (updateError) failSafely("Änderung fehlgeschlagen.", updateError, "machines");
    if (!updated) {
      throw new Error("Der Standort wurde zwischenzeitlich geändert. Bitte neu laden.");
    }

    const trail = "Standort administrativ geändert";
    const { error: movementError } = await supabaseAdmin.from("movements").insert({
      machine_id: machine.id,
      movement_type: "transfer",
      performed_by: context.userId,
      responsible_user_id: machine.responsible_user_id,
      from_site_id: previousSiteId,
      to_site_id: data.siteId,
      comment: data.comment ? `${trail} · ${data.comment}` : trail,
    });
    if (movementError) {
      await supabaseAdmin
        .from("machines")
        .update({ current_site_id: previousSiteId })
        .eq("id", machine.id);
      throw new Error("Änderung konnte nicht protokolliert werden. Vorgang abgebrochen.");
    }

    return { ok: true as const };
  });

const updateSchema = z.object({
  machineId: z.string().uuid(),
  assetCode: z.string().trim().min(1).max(60),
  name: z.string().trim().min(2).max(160),
  categoryId: z.string().uuid().nullable().optional(),
  manufacturer: optionalText(120),
  model: optionalText(120),
  serialNumber: optionalText(120),
  companyInventoryNumber: optionalText(120),
  siteId: z.string().uuid().nullable().optional(),
  description: optionalText(2000),
  inspectionRequired: z.boolean().default(false),
  lastInspectionDate: optionalDate,
  nextInspectionDate: optionalDate,
  purchaseDate: optionalDate,
  purchasePrice: z.number().nonnegative().nullable().optional(),
  properties: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
});

/**
 * Stammdatenpflege durch Administratoren, Bauleiter und Lagerverwalter.
 * Bewusst ohne Status, Verantwortlichkeit und Rückgabedatum — dafür bleiben
 * Ausleihe/Rückgabe und die administrative Zuweisung zuständig.
 * Ein Standortwechsel wird als Bewegung "transfer" protokolliert; reine
 * Textänderungen fluten den Verlauf nicht.
 */
export const updateMachine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { requireDeviceManager } = await import("./roles.server");
    await requireDeviceManager(context.supabase, "Du darfst keine Gerätestammdaten bearbeiten.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: machine, error: readError } = await supabaseAdmin
      .from("machines")
      .select("id, current_site_id")
      .eq("id", data.machineId)
      .maybeSingle();
    if (readError || !machine) throw new Error("Gerät konnte nicht geladen werden.");

    const assetCode = data.assetCode.trim();
    const { data: duplicate } = await supabaseAdmin
      .from("machines")
      .select("id")
      .eq("asset_code", assetCode)
      .neq("id", machine.id)
      .maybeSingle();
    if (duplicate) throw new Error("Diese Gerätenummer ist bereits vergeben.");

    const nextSiteId = data.siteId ?? null;
    const { error } = await supabaseAdmin
      .from("machines")
      .update({
        asset_code: assetCode,
        name: data.name.trim(),
        category_id: data.categoryId ?? null,
        manufacturer: data.manufacturer,
        model: data.model,
        serial_number: data.serialNumber,
        company_inventory_number: data.companyInventoryNumber,
        current_site_id: nextSiteId,
        description: data.description,
        inspection_required: data.inspectionRequired,
        last_inspection_date: data.lastInspectionDate,
        next_inspection_date: data.nextInspectionDate,
        purchase_date: data.purchaseDate,
        purchase_price: data.purchasePrice ?? null,
      })
      .eq("id", machine.id);
    if (error) failSafely("Änderung fehlgeschlagen.", error, "machines");

    if ((machine.current_site_id ?? null) !== nextSiteId) {
      await supabaseAdmin.from("movements").insert({
        machine_id: machine.id,
        movement_type: "transfer",
        performed_by: context.userId,
        from_site_id: machine.current_site_id,
        to_site_id: nextSiteId,
        comment: "Standort über Gerätebearbeitung geändert",
      });
    }

    if (data.properties) {
      const { replaceMachineProperties } = await import("./machine-properties.server");
      try {
        await replaceMachineProperties(supabaseAdmin, machine.id, data.properties);
      } catch (propertyError) {
        failSafely("Eigenschaften konnten nicht gespeichert werden.", propertyError, "properties");
      }
    }

    return { ok: true as const };
  });

/* ------------------------------------------------------------------ *
 * Lebenszyklus: Deaktivieren / Reaktivieren / Löschen
 * Ausschließlich Administratoren. Die Rollenprüfung erfolgt serverseitig
 * frisch über current_profile() — Frontend-Zustand wird nie vertraut.
 * ------------------------------------------------------------------ */

const PHOTO_BUCKET = "machine-photos";
const thumbPathFor = (path: string) => path.replace(/(\.[a-z0-9]+)$/i, "_thumb$1");

async function requireAdminForLifecycle(supabase: unknown) {
  const { requireManager } = await import("./roles.server");
  await requireManager(supabase, {
    adminOnly: true,
    message: "Nur Administratoren dürfen Geräte deaktivieren oder löschen.",
  });
}

const setActiveSchema = z.object({
  machineId: z.string().uuid(),
  active: z.boolean(),
  comment: z.string().trim().max(2000).nullable().optional(),
});

/** Archivieren bzw. Reaktivieren eines Geräts — Historie bleibt erhalten. */
export const setMachineActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => setActiveSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdminForLifecycle(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: machine, error: readError } = await supabaseAdmin
      .from("machines")
      .select("id, active, status, current_site_id, responsible_user_id")
      .eq("id", data.machineId)
      .maybeSingle();
    if (readError || !machine) throw new Error("Gerät konnte nicht geladen werden.");
    if ((machine.active ?? true) === data.active) {
      throw new Error(
        data.active ? "Das Gerät ist bereits aktiv." : "Das Gerät ist bereits deaktiviert.",
      );
    }

    if (!data.active) {
      if (machine.responsible_user_id) {
        throw new Error(
          "Das Gerät befindet sich in der Obhut eines Mitarbeiters. Bitte zuerst die Rückgabe erfassen.",
        );
      }
      const { count: pendingHandovers } = await supabaseAdmin
        .from("machine_handovers")
        .select("id", { count: "exact", head: true })
        .eq("machine_id", machine.id)
        .eq("status", "pending");
      if ((pendingHandovers ?? 0) > 0) {
        throw new Error("Für dieses Gerät läuft noch eine Geräteübergabe. Bitte zuerst klären.");
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("machines")
      .update({ active: data.active })
      .eq("id", machine.id)
      .eq("active", machine.active ?? true);
    if (updateError) failSafely("Änderung fehlgeschlagen.", updateError, "machines");

    const trail = data.active
      ? "Gerät reaktiviert (administrativ)"
      : "Gerät deaktiviert / archiviert (administrativ)";
    await supabaseAdmin.from("movements").insert({
      machine_id: machine.id,
      movement_type: "assignment",
      performed_by: context.userId,
      responsible_user_id: null,
      from_site_id: machine.current_site_id,
      to_site_id: machine.current_site_id,
      comment: data.comment ? `${trail} · ${data.comment}` : trail,
    });

    return { ok: true as const, active: data.active };
  });

const machineIdSchema = z.object({ machineId: z.string().uuid() });

/**
 * Prüft vor dem endgültigen Löschen, ob Betriebshistorie oder eine laufende
 * Obhut bestehen. Historie wird niemals stillschweigend mitgelöscht.
 */
export const getMachineDeletionCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => machineIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdminForLifecycle(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: machine } = await supabaseAdmin
      .from("machines")
      .select("id, name, asset_code, active, responsible_user_id")
      .eq("id", data.machineId)
      .maybeSingle();
    if (!machine) throw new Error("Gerät konnte nicht geladen werden.");

    const countOf = async (table: "movements" | "machine_handovers" | "reservations" | "defects" | "maintenance") => {
      const { count } = await supabaseAdmin
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("machine_id", machine.id);
      return count ?? 0;
    };

    const [movements, handovers, reservations, defects, maintenance] = await Promise.all([
      countOf("movements"),
      countOf("machine_handovers"),
      countOf("reservations"),
      countOf("defects"),
      countOf("maintenance"),
    ]);

    const inCustody = !!machine.responsible_user_id;
    const history = movements + handovers + reservations + defects + maintenance;

    return {
      machineId: machine.id,
      name: machine.name,
      assetCode: machine.asset_code,
      active: machine.active ?? true,
      inCustody,
      movements,
      handovers,
      reservations,
      defects,
      maintenance,
      hasHistory: history > 0,
      canDelete: !inCustody && history === 0,
    };
  });

/**
 * Endgültiges Löschen — nur für fehlerhaft angelegte Datensätze ohne
 * Betriebshistorie. Alles andere wird deaktiviert/archiviert.
 */
export const deleteMachine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => machineIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdminForLifecycle(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: machine } = await supabaseAdmin
      .from("machines")
      .select("id, responsible_user_id")
      .eq("id", data.machineId)
      .maybeSingle();
    if (!machine) throw new Error("Gerät konnte nicht geladen werden.");
    if (machine.responsible_user_id) {
      throw new Error(
        "Das Gerät befindet sich in der Obhut eines Mitarbeiters. Bitte zuerst die Rückgabe erfassen.",
      );
    }

    const tables = ["movements", "machine_handovers", "reservations", "defects", "maintenance"] as const;
    for (const table of tables) {
      const { count } = await supabaseAdmin
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("machine_id", machine.id);
      if ((count ?? 0) > 0) {
        throw new Error(
          "Dieses Gerät hat bereits Betriebshistorie. Bitte deaktivieren/archivieren statt löschen — so bleibt die Nachvollziehbarkeit erhalten.",
        );
      }
    }

    const { data: photos } = await supabaseAdmin
      .from("machine_photos")
      .select("id, storage_path")
      .eq("machine_id", machine.id);
    const paths = (photos ?? []).flatMap((p) => [p.storage_path, thumbPathFor(p.storage_path)]);
    if (paths.length > 0) {
      await supabaseAdmin.storage.from(PHOTO_BUCKET).remove(paths);
    }
    await supabaseAdmin.from("machine_photos").delete().eq("machine_id", machine.id);
    await supabaseAdmin.from("machine_property_assignments").delete().eq("machine_id", machine.id);
    await supabaseAdmin.from("accessories").delete().eq("machine_id", machine.id);

    const { error } = await supabaseAdmin.from("machines").delete().eq("id", machine.id);
    if (error) failSafely("Gerät konnte nicht gelöscht werden.", error, "machines");

    return { ok: true as const };
  });
