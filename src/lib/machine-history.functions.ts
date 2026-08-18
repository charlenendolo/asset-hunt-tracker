import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin-only Geräteverlauf.
 *
 * Der Verlauf legt KEINE neuen Ereignistabellen an: er verbindet die bereits
 * vorhandenen Datensätze (movements, defects, maintenance, reservations) zu
 * einer chronologischen Sicht. Es werden ausschließlich real gespeicherte
 * Zeitpunkte verwendet — kein Ereignis wird rekonstruiert oder erfunden.
 *
 * Die Rollenprüfung erfolgt serverseitig (nur admin), zusätzlich zur
 * bestehenden RLS. Lesen erfolgt danach mit dem Adminclient, damit auch
 * historische Bezüge zu deaktivierten Personen/Standorten sichtbar bleiben.
 */

export type MachineHistoryEvent = {
  id: string;
  at: string;
  kind:
    | "checkout"
    | "return"
    | "assignment"
    | "transfer"
    | "defect_reported"
    | "defect_resolved"
    | "maintenance_scheduled"
    | "maintenance_completed"
    | "reservation";
  title: string;
  /** Wen betrifft das Ereignis (Obhut/Empfänger/Melder). */
  subject: string | null;
  /** Wer hat gehandelt, falls abweichend erfasst. */
  actor: string | null;
  fromSite: string | null;
  toSite: string | null;
  detail: string | null;
  /** Nur bei Datumsangaben ohne Uhrzeit (Wartung). */
  dateOnly?: boolean;
};

const inputSchema = z.object({ machineId: z.string().uuid() });

export const getMachineHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { requireManager } = await import("./roles.server");
    await requireManager(context.supabase, {
      adminOnly: true,
      message: "Der Geräteverlauf ist Administratoren vorbehalten.",
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const machineId = data.machineId;

    const [movements, defects, maintenance, reservations] = await Promise.all([
      supabaseAdmin
        .from("movements")
        .select(
          "id, movement_type, condition, comment, equipment_complete, created_at, responsible:profiles!movements_responsible_user_id_fkey(full_name), performer:profiles!movements_performed_by_fkey(full_name), from_site:sites!movements_from_site_id_fkey(name), to_site:sites!movements_to_site_id_fkey(name)",
        )
        .eq("machine_id", machineId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("defects")
        .select(
          "id, description, severity, status, created_at, resolved_at, reporter:profiles!defects_reported_by_fkey(full_name), resolver:profiles!defects_resolved_by_fkey(full_name)",
        )
        .eq("machine_id", machineId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("maintenance")
        .select(
          "id, maintenance_type, scheduled_date, completed_date, status, service_provider, notes, created_at",
        )
        .eq("machine_id", machineId)
        .limit(200),
      supabaseAdmin
        .from("reservations")
        .select(
          "id, start_at, end_at, status, notes, created_at, site:sites(name), reserved:profiles!reservations_reserved_by_fkey(full_name)",
        )
        .eq("machine_id", machineId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const firstError = [movements, defects, maintenance, reservations].find((r) => r.error);
    if (firstError?.error) {
      throw new Error("Verlauf konnte nicht geladen werden: " + firstError.error.message);
    }

    const events: MachineHistoryEvent[] = [];
    const dateFmt = new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const fmtDate = (value: string | null) =>
      value ? dateFmt.format(new Date(`${value}T00:00:00`)) : null;

    for (const mv of movements.data ?? []) {
      const type = (mv.movement_type ?? "").toLowerCase();
      const kind: MachineHistoryEvent["kind"] =
        type === "checkout"
          ? "checkout"
          : type === "return" || type === "checkin"
            ? "return"
            : type === "assignment"
              ? "assignment"
              : "transfer";
      const title =
        kind === "checkout"
          ? "Ausgeliehen"
          : kind === "return"
            ? "Zurückgegeben"
            : kind === "assignment"
              ? "Manuell zugewiesen"
              : "Standort geändert";

      const details: string[] = [];
      if (mv.equipment_complete === false) details.push("Zubehör unvollständig");
      if (mv.equipment_complete === true) details.push("Zubehör vollständig");
      if (mv.condition) details.push(`Zustand: ${mv.condition}`);
      if (mv.comment) details.push(mv.comment);

      const responsible = mv.responsible?.full_name ?? null;
      const performer = mv.performer?.full_name ?? null;

      events.push({
        id: `mv-${mv.id}`,
        at: mv.created_at,
        kind,
        title,
        subject: responsible ?? performer,
        // Bei Selbstbedienung (QR) sind Handelnder und Obhut identisch —
        // dann keine doppelte Nennung. Administrative Zuweisungen bleiben
        // dadurch klar unterscheidbar.
        actor: performer && performer !== responsible ? performer : null,
        fromSite: mv.from_site?.name ?? null,
        toSite: mv.to_site?.name ?? null,
        detail: details.length > 0 ? details.join(" · ") : null,
      });
    }

    for (const d of defects.data ?? []) {
      events.push({
        id: `df-${d.id}`,
        at: d.created_at,
        kind: "defect_reported",
        title: "Defekt gemeldet",
        subject: d.reporter?.full_name ?? null,
        actor: null,
        fromSite: null,
        toSite: null,
        detail: d.description ?? null,
      });
      if (d.status === "resolved" && d.resolved_at) {
        events.push({
          id: `dfr-${d.id}`,
          at: d.resolved_at,
          kind: "defect_resolved",
          title: "Defekt behoben",
          subject: d.resolver?.full_name ?? null,
          actor: null,
          fromSite: null,
          toSite: null,
          detail: null,
        });
      }
    }

    for (const w of maintenance.data ?? []) {
      const label = w.maintenance_type ?? "Wartung";
      const provider = w.service_provider ?? null;
      const detail = [w.notes].filter(Boolean).join(" · ") || null;
      if (w.scheduled_date) {
        events.push({
          id: `mt-${w.id}`,
          at: `${w.scheduled_date}T00:00:00.000Z`,
          kind: "maintenance_scheduled",
          title: "Wartung begonnen",
          subject: provider,
          actor: null,
          fromSite: null,
          toSite: null,
          detail: [label, detail].filter(Boolean).join(" · ") || null,
          dateOnly: true,
        });
      }
      if (w.completed_date) {
        events.push({
          id: `mtc-${w.id}`,
          at: `${w.completed_date}T00:00:00.000Z`,
          kind: "maintenance_completed",
          title: "Wartung abgeschlossen",
          subject: provider,
          actor: null,
          fromSite: null,
          toSite: null,
          detail: [label, detail].filter(Boolean).join(" · ") || null,
          dateOnly: true,
        });
      }
    }

    for (const r of reservations.data ?? []) {
      const cancelled = (r.status ?? "").toLowerCase() === "cancelled";
      const range = `${fmtDate(r.start_at.slice(0, 10))} – ${fmtDate(r.end_at.slice(0, 10))}`;
      events.push({
        id: `rs-${r.id}`,
        at: r.created_at,
        kind: "reservation",
        // Für Stornierungen ist kein Zeitpunkt erfasst — deshalb wird der
        // Status am ursprünglichen Ereignis gezeigt statt ein Datum zu erfinden.
        title: cancelled ? "Reservierung storniert" : "Reserviert",
        subject: r.reserved?.full_name ?? null,
        actor: null,
        fromSite: null,
        toSite: r.site?.name ?? null,
        detail: [range, r.notes].filter(Boolean).join(" · "),
      });
    }

    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return { events: events.slice(0, 300) };
  });
