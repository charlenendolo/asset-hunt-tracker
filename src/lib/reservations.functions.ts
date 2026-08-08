import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Reservations are written through the authenticated user's own Supabase
 * client, so the existing RLS policy ("Users can create reservations" with
 * reserved_by = auth.uid()) stays authoritative. No admin client, no schema or
 * policy change. The overlap check runs server-side to avoid trusting the
 * client and to keep a single source of truth for conflicts.
 */

const schema = z.object({
  machineId: z.string().uuid(),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  siteId: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const createReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const start = new Date(data.startAt);
    const end = new Date(data.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error("Ungültiger Zeitraum.");
    }
    if (end.getTime() <= start.getTime()) {
      throw new Error("Das Ende muss nach dem Beginn liegen.");
    }

    // Overlap: existing.start < new.end AND existing.end > new.start
    const { data: conflicts, error: conflictError } = await supabase
      .from("reservations")
      .select("id, start_at, end_at, status")
      .eq("machine_id", data.machineId)
      .neq("status", "cancelled")
      .lt("start_at", end.toISOString())
      .gt("end_at", start.toISOString())
      .order("start_at")
      .limit(1);
    if (conflictError) throw new Error("Reservierungen konnten nicht geprüft werden.");

    const clash = conflicts?.[0];
    if (clash) {
      const fmt = new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      throw new Error(
        `Das Gerät ist in diesem Zeitraum bereits reserviert. Belegt: ${fmt.format(
          new Date(clash.start_at),
        )} – ${fmt.format(new Date(clash.end_at))}.`,
      );
    }

    const { data: inserted, error } = await supabase
      .from("reservations")
      .insert({
        machine_id: data.machineId,
        reserved_by: userId,
        site_id: data.siteId ?? null,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        status: "confirmed",
        notes: data.notes ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error("Reservierung konnte nicht gespeichert werden: " + error.message);

    return { id: inserted.id };
  });
