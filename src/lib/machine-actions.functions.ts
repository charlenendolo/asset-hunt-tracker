import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { failSafely } from "@/lib/safe-error";

/**
 * Checkout / return are executed server-side because the existing RLS policy
 * "Admins manage machines" only allows admins to UPDATE public.machines.
 * Authorisation is therefore enforced here (authenticated user + role + current
 * responsibility) before a privileged update is issued. No RLS/schema change.
 */

const checkoutSchema = z.object({
  machineId: z.string().uuid(),
  siteId: z.string().uuid().nullable().optional(),
  equipmentComplete: z.boolean(),
  condition: z.string().max(120).nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
  expectedReturnAt: z.string().datetime({ offset: true }).nullable().optional(),
});

const returnSchema = z.object({
  machineId: z.string().uuid(),
  siteId: z.string().uuid().nullable().optional(),
  equipmentComplete: z.boolean(),
  // must match DB check constraint movements_condition_check
  condition: z.enum(["good", "damaged", "incomplete"]).nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
});


const AVAILABLE = ["available", "verfuegbar", "verfügbar", "frei"];
const CHECKED_OUT = ["checked_out", "borrowed", "ausgeliehen", "in_use"];

export const checkoutMachine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => checkoutSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const { requireActiveUser } = await import("./roles.server");
    await requireActiveUser(context.supabase);

    const { data: machine, error: readError } = await supabaseAdmin
      .from("machines")
      .select("id, status, current_site_id, responsible_user_id, active, site:sites(location_type)")
      .eq("id", data.machineId)
      .maybeSingle();
    if (readError) throw new Error("Gerät konnte nicht geladen werden.");
    if (!machine) throw new Error("Gerät nicht gefunden.");

    const status = (machine.status ?? "").toLowerCase();
    // Defekte Geräte sind niemals ausleihbar — erst nach dokumentierter Reparatur.
    if (["defective", "defekt", "defect"].includes(status)) {
      throw new Error(
        "Das Gerät ist als defekt gemeldet und kann erst nach abgeschlossener Reparatur wieder ausgeliehen werden.",
      );
    }
    // Zusätzlich: offene Defektmeldungen blockieren die Ausleihe.
    const { count: openDefects } = await supabaseAdmin
      .from("defects")
      .select("id", { count: "exact", head: true })
      .eq("machine_id", machine.id)
      .neq("status", "resolved");
    if ((openDefects ?? 0) > 0) {
      throw new Error(
        "Für dieses Gerät ist ein Defekt offen. Es kann erst nach abgeschlossener Reparatur wieder ausgeliehen werden.",
      );
    }
    if (!machine.active || !AVAILABLE.includes(status)) {
      throw new Error(
        "Das Gerät ist nicht mehr verfügbar. Der Status wurde zwischenzeitlich geändert.",
      );
    }


    // Abgeleiteter Status „Zugewiesen": Geräte an Baustellen oder in Fahrzeugen
    // sind dort im Einsatz und dürfen nicht erneut ausgeliehen werden.
    const { isAssignedSiteType } = await import("@/lib/status");
    if (isAssignedSiteType(machine.site?.location_type ?? null)) {
      throw new Error(
        "Das Gerät ist einem Standort zugewiesen und steht dort im Einsatz. Es kann nicht ausgeliehen werden.",
      );
    }

    const toSiteId = data.siteId ?? machine.current_site_id ?? null;

    // Conditional update = optimistic lock against double checkout.
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("machines")
      .update({
        status: "checked_out",
        responsible_user_id: userId,
        current_site_id: toSiteId,
        expected_return_at: data.expectedReturnAt ?? null,
      })
      .eq("id", machine.id)
      .eq("status", machine.status)
      .is("responsible_user_id", null)
      .select("id")
      .maybeSingle();
    if (updateError) failSafely("Ausleihe fehlgeschlagen.", updateError, "checkout");
    if (!updated) {
      throw new Error(
        "Das Gerät ist nicht mehr verfügbar. Der Status wurde zwischenzeitlich geändert.",
      );
    }

    const { error: movementError } = await supabaseAdmin.from("movements").insert({
      machine_id: machine.id,
      movement_type: "checkout",
      performed_by: userId,
      responsible_user_id: userId,
      from_site_id: machine.current_site_id,
      to_site_id: toSiteId,
      equipment_complete: data.equipmentComplete,
      condition: data.condition ?? null,
      comment: data.comment ?? null,
      expected_return_at: data.expectedReturnAt ?? null,
    });
    if (movementError) {
      // Roll back so the UI never shows a partially applied success.
      await supabaseAdmin
        .from("machines")
        .update({
          status: machine.status,
          responsible_user_id: null,
          current_site_id: machine.current_site_id,
          expected_return_at: null,
        })
        .eq("id", machine.id);
      throw new Error("Bewegung konnte nicht protokolliert werden. Ausleihe abgebrochen.");
    }

    return { ok: true as const };
  });

export const returnMachine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => returnSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const { requireActiveUser } = await import("./roles.server");
    await requireActiveUser(context.supabase);

    const [{ data: machine, error: readError }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("machines")
        .select("id, status, current_site_id, responsible_user_id, expected_return_at")
        .eq("id", data.machineId)
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("role, active").eq("id", userId).maybeSingle(),
    ]);
    if (readError) throw new Error("Gerät konnte nicht geladen werden.");
    if (!machine) throw new Error("Gerät nicht gefunden.");

    const status = (machine.status ?? "").toLowerCase();

    // Jeder aktive Benutzer darf ein Gerät zurückgeben — auch für jemand
    // anderen. Deaktivierte Zugänge werden serverseitig abgewiesen.
    if (!profile?.active) {
      throw new Error("Dein Zugang ist deaktiviert. Bitte wende dich an die Verwaltung.");
    }

    // Ein während der Obhut gemeldeter Defekt setzt den Status auf "defective".
    // Die Rückgabe muss trotzdem möglich bleiben, solange jemand verantwortlich ist.
    const inCustody =
      CHECKED_OUT.includes(status) || (status === "defective" && !!machine.responsible_user_id);
    if (!inCustody) {
      throw new Error(
        "Das Gerät ist nicht mehr ausgeliehen. Der Status wurde zwischenzeitlich geändert.",
      );
    }



    // Eine offene Übergabe darf die Rückgabe nicht überdauern — sie wird
    // vorher zurückgezogen, damit keine widersprüchliche Obhut entsteht.
    await supabaseAdmin
      .from("machine_handovers")
      .update({ status: "withdrawn", responded_at: new Date().toISOString() })
      .eq("machine_id", machine.id)
      .eq("status", "pending");

    const toSiteId = data.siteId ?? machine.current_site_id ?? null;

    // Offene Defekte überdauern die Rückgabe: das Gerät bleibt gesperrt.
    const { count: openDefects } = await supabaseAdmin
      .from("defects")
      .select("id", { count: "exact", head: true })
      .eq("machine_id", machine.id)
      .neq("status", "resolved");
    const nextStatus = status === "defective" || (openDefects ?? 0) > 0 ? "defective" : "available";

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("machines")
      .update({
        status: nextStatus,
        responsible_user_id: null,
        current_site_id: toSiteId,
        expected_return_at: null,
      })
      .eq("id", machine.id)
      .eq("status", machine.status)
      .eq("responsible_user_id", machine.responsible_user_id ?? userId)
      .select("id")
      .maybeSingle();
    if (updateError) failSafely("Rückgabe fehlgeschlagen.", updateError, "return");
    if (!updated) {
      throw new Error(
        "Das Gerät ist nicht mehr ausgeliehen. Der Status wurde zwischenzeitlich geändert.",
      );
    }

    const { error: movementError } = await supabaseAdmin.from("movements").insert({
      machine_id: machine.id,
      movement_type: "return",
      performed_by: userId,
      responsible_user_id: machine.responsible_user_id,
      from_site_id: machine.current_site_id,
      to_site_id: toSiteId,
      equipment_complete: data.equipmentComplete,
      condition: data.condition ?? null,
      comment: data.comment ?? null,
    });
    if (movementError) {
      await supabaseAdmin
        .from("machines")
        .update({
          status: machine.status,
          responsible_user_id: machine.responsible_user_id,
          current_site_id: machine.current_site_id,
          expected_return_at: machine.expected_return_at,
        })
        .eq("id", machine.id);
      throw new Error(
        "Bewegung konnte nicht protokolliert werden. Rückgabe abgebrochen.",
      );
    }

    return { ok: true as const };
  });
