import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { failSafely } from "@/lib/safe-error";

/**
 * Geräteübergabe zwischen Mitarbeitern (zweistufig).
 *
 * Stufe 1: Der aktuelle Träger der Obhut fragt eine Übergabe an — die Obhut
 * bleibt vollständig bei ihm, der Gerätestatus bleibt „ausgeliehen".
 * Stufe 2: Erst die Bestätigung der empfangenden Person verschiebt die Obhut.
 *
 * Alle Prüfungen (Authentifizierung, Aktivstatus, tatsächliche Obhut,
 * beabsichtigter Empfänger, offener Vorgang) erfolgen serverseitig gegen den
 * Datenbankstand; Angaben aus dem Browser werden nie als Nachweis akzeptiert.
 */

const CHECKED_OUT = ["checked_out", "borrowed", "ausgeliehen", "in_use"];

export type HandoverStatus = "pending" | "accepted" | "rejected" | "withdrawn" | "expired";

export type HandoverRow = {
  id: string;
  machineId: string;
  machineName: string;
  assetCode: string;
  siteName: string | null;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  status: HandoverStatus;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
  note: string | null;
};

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

/** Abgelaufene Anfragen werden vor jedem Lesen/Handeln träge geschlossen. */
async function expireStale(admin: AdminClient) {
  await admin
    .from("machine_handovers")
    .update({ status: "expired", responded_at: new Date().toISOString() })
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());
}

const SELECT =
  "id, machine_id, from_user_id, to_user_id, status, note, created_at, expires_at, responded_at, machine:machines(id, name, asset_code, site:sites(name)), from_user:profiles!machine_handovers_from_user_id_fkey(full_name), to_user:profiles!machine_handovers_to_user_id_fkey(full_name)";

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRow(row: any): HandoverRow {
  return {
    id: row.id,
    machineId: row.machine_id,
    machineName: row.machine?.name ?? "Unbekanntes Gerät",
    assetCode: row.machine?.asset_code ?? "",
    siteName: row.machine?.site?.name ?? null,
    fromUserId: row.from_user_id,
    fromName: row.from_user?.full_name ?? "Unbekannt",
    toUserId: row.to_user_id,
    toName: row.to_user?.full_name ?? "Unbekannt",
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    respondedAt: row.responded_at,
    note: row.note,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Offene Übergabe eines Geräts (für Gerätepass). */
export const getMachineHandover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ machineId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { requireActiveUser } = await import("./roles.server");
    await requireActiveUser(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await expireStale(supabaseAdmin);

    const { data: row, error } = await supabaseAdmin
      .from("machine_handovers")
      .select(SELECT)
      .eq("machine_id", data.machineId)
      .eq("status", "pending")
      .maybeSingle();
    if (error) failSafely("Übergabe konnte nicht geladen werden.", error, "handover");
    return row ? mapRow(row) : null;
  });

/** Eigene Übergaben: eingehend (bestätigen) und ausgehend (zurückziehen). */
export const listMyHandovers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireActiveUser } = await import("./roles.server");
    await requireActiveUser(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await expireStale(supabaseAdmin);

    const { data, error } = await supabaseAdmin
      .from("machine_handovers")
      .select(SELECT)
      .eq("status", "pending")
      .or(`to_user_id.eq.${context.userId},from_user_id.eq.${context.userId}`)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) failSafely("Übergaben konnten nicht geladen werden.", error, "handover");

    const rows = (data ?? []).map(mapRow);
    return {
      incoming: rows.filter((r) => r.toUserId === context.userId),
      outgoing: rows.filter((r) => r.fromUserId === context.userId),
    };
  });

/** Kompakte Adminübersicht über alle Übergaben. */
export const listAllHandovers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireManager } = await import("./roles.server");
    await requireManager(context.supabase, {
      adminOnly: true,
      message: "Die Übersicht der Übergaben ist Administratoren vorbehalten.",
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await expireStale(supabaseAdmin);

    const { data, error } = await supabaseAdmin
      .from("machine_handovers")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) failSafely("Übergaben konnten nicht geladen werden.", error, "handover");
    return (data ?? []).map(mapRow);
  });

/** Stufe 1 — Übergabe anfragen. Die Obhut bleibt unverändert. */
export const requestHandover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        machineId: z.string().uuid(),
        toUserId: z.string().uuid(),
        note: z.string().trim().max(500).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { requireActiveUser } = await import("./roles.server");
    await requireActiveUser(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await expireStale(supabaseAdmin);

    const userId = context.userId;
    if (data.toUserId === userId) {
      throw new Error("Du kannst ein Gerät nicht an dich selbst übergeben.");
    }

    const [{ data: machine }, { data: receiver }] = await Promise.all([
      supabaseAdmin
        .from("machines")
        .select("id, status, active, responsible_user_id")
        .eq("id", data.machineId)
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("id, active")
        .eq("id", data.toUserId)
        .maybeSingle(),
    ]);

    if (!machine || !machine.active) throw new Error("Gerät nicht gefunden.");
    if (machine.responsible_user_id !== userId) {
      throw new Error("Du hast dieses Gerät nicht in Obhut.");
    }
    const status = (machine.status ?? "").toLowerCase();
    if (!CHECKED_OUT.includes(status) && status !== "defective") {
      throw new Error("Dieses Gerät kann derzeit nicht übergeben werden.");
    }
    if (!receiver || receiver.active !== true) {
      throw new Error("Die ausgewählte Person ist nicht aktiv.");
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("machine_handovers")
      .insert({
        machine_id: machine.id,
        from_user_id: userId,
        to_user_id: data.toUserId,
        status: "pending",
        note: data.note ?? null,
      })
      .select("id")
      .maybeSingle();
    if (error) {
      // Eindeutiger Teilindex: pro Gerät nur eine offene Übergabe.
      if (String((error as { code?: string }).code) === "23505") {
        throw new Error("Für dieses Gerät läuft bereits eine Übergabe.");
      }
      failSafely("Übergabe konnte nicht angefragt werden.", error, "handover");
    }
    return { id: inserted?.id as string };
  });

/** Der Absender zieht seine offene Anfrage zurück. */
export const withdrawHandover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ handoverId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { requireActiveUser } = await import("./roles.server");
    await requireActiveUser(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: updated, error } = await supabaseAdmin
      .from("machine_handovers")
      .update({ status: "withdrawn", responded_at: new Date().toISOString() })
      .eq("id", data.handoverId)
      .eq("status", "pending")
      .eq("from_user_id", context.userId)
      .select("id")
      .maybeSingle();
    if (error) failSafely("Übergabe konnte nicht zurückgezogen werden.", error, "handover");
    if (!updated) throw new Error("Diese Übergabe ist nicht mehr offen.");
    return { ok: true as const };
  });

const respondSchema = z.object({
  handoverId: z.string().uuid(),
  action: z.enum(["accept", "reject"]),
  pin: z
    .string()
    .regex(/^\d{4}$/)
    .nullable()
    .optional(),
  /** Zustandsbestätigung bei Annahme. */
  condition: z.enum(["good", "defect"]).default("good"),
  defectDescription: z.string().trim().max(2000).nullable().optional(),
});

/** Stufe 2 — die empfangende Person bestätigt oder lehnt ab. */
export const respondHandover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => respondSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { requireActiveUser } = await import("./roles.server");
    const role = await requireActiveUser(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await expireStale(supabaseAdmin);

    const userId = context.userId;
    const { data: handover } = await supabaseAdmin
      .from("machine_handovers")
      .select("id, machine_id, from_user_id, to_user_id, status")
      .eq("id", data.handoverId)
      .maybeSingle();

    // Nur der beabsichtigte Empfänger darf antworten — die ID aus dem Browser
    // wird nie als Nachweis verwendet.
    if (!handover || handover.to_user_id !== userId) {
      throw new Error("Diese Übergabe ist nicht für dich bestimmt.");
    }
    if (handover.status !== "pending") {
      throw new Error("Diese Übergabe ist nicht mehr offen.");
    }

    const now = new Date().toISOString();

    if (data.action === "reject") {
      const { data: rejected, error } = await supabaseAdmin
        .from("machine_handovers")
        .update({ status: "rejected", responded_at: now })
        .eq("id", handover.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (error) failSafely("Übergabe konnte nicht abgelehnt werden.", error, "handover");
      if (!rejected) throw new Error("Diese Übergabe ist nicht mehr offen.");
      return { ok: true as const, accepted: false };
    }

    // PIN-Bestätigung für Mitarbeiter (bestehende Prüfung, kein zweites System).
    const isManager = ["admin", "site_manager", "manager", "bauleiter"].includes(role);
    if (!isManager) {
      if (!data.pin) throw new Error("Bitte bestätige die Übernahme mit deinem PIN.");
      const { verifyEmployeePin } = await import("./pin-verify.server");
      const check = await verifyEmployeePin({ user_id: userId }, data.pin);
      if (!check.ok) {
        if (check.reason === "locked") {
          throw new Error("PIN vorübergehend gesperrt. Bitte später erneut versuchen.");
        }
        if (check.reason === "wrong_pin") throw new Error("PIN ist nicht korrekt.");
        throw new Error("PIN-Zugang ist nicht aktiv. Bitte wende dich an die Verwaltung.");
      }
    }

    const { data: machine } = await supabaseAdmin
      .from("machines")
      .select("id, status, active, responsible_user_id, current_site_id")
      .eq("id", handover.machine_id)
      .maybeSingle();
    if (!machine || !machine.active) throw new Error("Gerät nicht gefunden.");
    if (machine.responsible_user_id !== handover.from_user_id) {
      throw new Error("Das Gerät ist nicht mehr in der Obhut der abgebenden Person.");
    }

    // Zustand „Defekt festgestellt": Defekt erfassen, Gerät bleibt gesperrt,
    // die Obhut geht trotzdem über — das Gerät wird nie „verfügbar".
    let defectId: string | null = null;
    if (data.condition === "defect") {
      const description = (data.defectDescription ?? "").trim();
      if (description.length < 5) {
        throw new Error("Bitte beschreibe den festgestellten Defekt.");
      }
      const { data: defect, error: defectError } = await supabaseAdmin
        .from("defects")
        .insert({
          machine_id: machine.id,
          reported_by: userId,
          site_id: machine.current_site_id,
          description,
          severity: "normal",
          status: "open",
        })
        .select("id")
        .maybeSingle();
      if (defectError) failSafely("Defekt konnte nicht erfasst werden.", defectError, "handover");
      defectId = defect?.id ?? null;
    }

    const { count: openDefects } = await supabaseAdmin
      .from("defects")
      .select("id", { count: "exact", head: true })
      .eq("machine_id", machine.id)
      .neq("status", "resolved");
    const nextStatus = (openDefects ?? 0) > 0 ? "defective" : machine.status;

    // Atomar: die Obhut wechselt nur, wenn sie beim Absender unverändert ist.
    const { data: moved, error: moveError } = await supabaseAdmin
      .from("machines")
      .update({ status: nextStatus, responsible_user_id: userId })
      .eq("id", machine.id)
      .eq("responsible_user_id", handover.from_user_id)
      .select("id")
      .maybeSingle();
    if (moveError) failSafely("Übernahme fehlgeschlagen.", moveError, "handover");
    if (!moved) throw new Error("Die Obhut hat sich zwischenzeitlich geändert.");

    const { data: closed } = await supabaseAdmin
      .from("machine_handovers")
      .update({ status: "accepted", responded_at: now })
      .eq("id", handover.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!closed) {
      // Doppelte Annahme: Obhut zurücksetzen, nur ein Abschluss darf gewinnen.
      await supabaseAdmin
        .from("machines")
        .update({ responsible_user_id: handover.from_user_id })
        .eq("id", machine.id);
      throw new Error("Diese Übergabe wurde bereits abgeschlossen.");
    }

    return { ok: true as const, accepted: true, defectId };
  });
