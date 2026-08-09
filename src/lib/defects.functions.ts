import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Defektvorgänge. Der Defekt-Datensatz und der Maschinenstatus werden immer
 * gemeinsam geschrieben, damit "Status defekt" und "Defektvorgang" nicht mehr
 * auseinanderlaufen können. Der Statuswechsel auf machines erfordert laut
 * bestehender RLS Adminrechte — deshalb serverseitig mit Rollenprüfung.
 */

const reportSchema = z.object({
  machineId: z.string().uuid(),
  description: z.string().trim().min(5).max(2000),
  // entspricht defects_severity_check
  severity: z.enum(["minor", "normal", "critical"]).default("normal"),
  siteId: z.string().uuid().nullable().optional(),
  blockMachine: z.boolean().default(true),
});

export const reportDefect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => reportSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: machine, error: readError } = await supabaseAdmin
      .from("machines")
      .select("id, status, current_site_id")
      .eq("id", data.machineId)
      .maybeSingle();
    if (readError || !machine) throw new Error("Gerät konnte nicht geladen werden.");

    const { data: inserted, error } = await supabaseAdmin
      .from("defects")
      .insert({
        machine_id: machine.id,
        reported_by: userId,
        site_id: data.siteId ?? machine.current_site_id ?? null,
        description: data.description,
        severity: data.severity,
        status: "open",
      })
      .select("id")
      .single();
    if (error) throw new Error("Defekt konnte nicht gespeichert werden: " + error.message);

    if (data.blockMachine && machine.status !== "defective") {
      const { error: statusError } = await supabaseAdmin
        .from("machines")
        .update({ status: "defective" })
        .eq("id", machine.id);
      if (statusError) {
        await supabaseAdmin.from("defects").delete().eq("id", inserted.id);
        throw new Error("Gerätestatus konnte nicht gesetzt werden. Vorgang abgebrochen.");
      }
    }

    return { id: inserted.id };
  });

const closeSchema = z.object({
  defectId: z.string().uuid(),
  note: z.string().trim().min(3).max(2000),
  setAvailable: z.boolean().default(true),
});

/**
 * Defekt abschließen. Historie bleibt vollständig erhalten: der Datensatz wird
 * auf "resolved" gesetzt (defects_status_check), resolved_at/resolved_by
 * werden gefüllt und der Reparaturvermerk wird an die Beschreibung angehängt —
 * das bestehende Schema hat kein eigenes Kommentarfeld.
 */
export const closeDefect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => closeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { requireManager } = await import("./roles.server");
    await requireManager(context.supabase, {
      message: "Nur Administratoren und Bauleiter dürfen Defekte abschließen.",
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: defect, error: readError } = await supabaseAdmin
      .from("defects")
      .select("id, machine_id, description, status")
      .eq("id", data.defectId)
      .maybeSingle();
    if (readError || !defect) throw new Error("Defektvorgang konnte nicht geladen werden.");
    if (defect.status === "resolved") throw new Error("Dieser Defekt ist bereits abgeschlossen.");

    const closedAt = new Date();
    const stamp = new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(closedAt);

    const { error } = await supabaseAdmin
      .from("defects")
      .update({
        status: "resolved",
        resolved_at: closedAt.toISOString(),
        resolved_by: context.userId,
        description: `${defect.description}\n\nAbschluss ${stamp}: ${data.note}`,
      })
      .eq("id", defect.id)
      .eq("status", defect.status);
    if (error) throw new Error("Defekt konnte nicht abgeschlossen werden: " + error.message);

    let machineFreed = false;
    if (data.setAvailable) {
      const { count } = await supabaseAdmin
        .from("defects")
        .select("id", { count: "exact", head: true })
        .eq("machine_id", defect.machine_id)
        .neq("status", "resolved");

      const { data: machine } = await supabaseAdmin
        .from("machines")
        .select("id, status, responsible_user_id")
        .eq("id", defect.machine_id)
        .maybeSingle();

      const blockedElsewhere =
        (count ?? 0) > 0 ||
        !machine ||
        machine.status === "maintenance" ||
        machine.status === "retired" ||
        machine.status === "checked_out";

      if (!blockedElsewhere && machine.status === "defective") {
        const { error: statusError } = await supabaseAdmin
          .from("machines")
          .update({ status: "available" })
          .eq("id", machine.id)
          .eq("status", "defective");
        if (!statusError) machineFreed = true;
      }
    }

    return { ok: true as const, machineFreed };
  });
