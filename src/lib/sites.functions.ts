import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SITE_TYPE_ORDER } from "@/lib/site-types";

/**
 * Standorte anlegen. Die RLS-Policy erlaubt Schreibzugriff nur Admins;
 * Bauleiter sollen ebenfalls anlegen dürfen, deshalb wird die Rolle
 * serverseitig über das eigene Profil geprüft und erst danach der
 * Service-Role-Client geladen.
 */
const MANAGE_ROLES = ["admin", "site_manager", "manager", "bauleiter"];

const createSiteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  locationType: z.enum(SITE_TYPE_ORDER),
  siteNumber: z.string().trim().max(60).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
});

export const createSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSiteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase.rpc("current_profile");
    const row = Array.isArray(profile) ? profile[0] : profile;
    const role = String(row?.role ?? "").toLowerCase();
    if (!row?.active || !MANAGE_ROLES.includes(role)) {
      throw new Error("Du darfst keine Standorte anlegen.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin
      .from("sites")
      .insert({
        name: data.name,
        location_type: data.locationType,
        site_number: data.siteNumber?.trim() || null,
        address: data.address?.trim() || null,
        active: true,
      })
      .select("id, name, site_number, address, active, location_type, created_at")
      .single();

    if (error || !created) throw new Error("Standort konnte nicht angelegt werden.");
    return created;
  });


const updateSiteSchema = z.object({
  siteId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  locationType: z.enum(SITE_TYPE_ORDER),
  siteNumber: z.string().trim().max(60).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  active: z.boolean().optional(),
});

/**
 * Standortdaten bearbeiten. Rollenprüfung serverseitig (Admin/Bauleiter),
 * erst danach privilegierter Schreibzugriff. Es werden nur Stammdaten des
 * Standorts geändert — Gerätezuordnungen und Historie bleiben unberührt.
 */
export const updateSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateSiteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase.rpc("current_profile");
    const row = Array.isArray(profile) ? profile[0] : profile;
    const role = String(row?.role ?? "").toLowerCase();
    if (!row?.active || !MANAGE_ROLES.includes(role)) {
      throw new Error("Du darfst keine Standorte bearbeiten.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("sites")
      .update({
        name: data.name,
        location_type: data.locationType,
        site_number: data.siteNumber?.trim() || null,
        address: data.address?.trim() || null,
        ...(typeof data.active === "boolean" ? { active: data.active } : {}),
      })
      .eq("id", data.siteId)
      .select("id, name, site_number, address, active, location_type")
      .maybeSingle();
    if (error) throw new Error("Standort konnte nicht gespeichert werden: " + error.message);
    if (!updated) throw new Error("Standort nicht gefunden.");
    return updated;
  });
