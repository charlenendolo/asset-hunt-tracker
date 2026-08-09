import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Fotos liegen im privaten Bucket "machine-photos". Lesen erfolgt über
 * Signed URLs (Storage-Policy: SELECT nur für authenticated). Schreiben
 * (Upload/Löschen/Hauptbild) läuft ausschließlich über diese Server-Funktionen:
 * Rolle wird serverseitig geprüft, danach schreibt der Service-Role-Client.
 * Die bestehenden RLS-Policies auf public.machine_photos bleiben unverändert.
 */
const BUCKET = "machine-photos";
const MANAGE_ROLES = ["admin", "site_manager", "manager", "bauleiter"];
const MAX_PHOTOS = 8;
const SIGNED_URL_TTL = 60 * 60;

const thumbPathFor = (path: string) => path.replace(/(\.[a-z0-9]+)$/i, "_thumb$1");

type SignedEntry = { path: string | null; signedUrl: string | null };

function signedUrlMap(entries: SignedEntry[] | null) {
  const map = new Map<string, string>();
  for (const entry of entries ?? []) {
    if (entry.path && entry.signedUrl) map.set(entry.path, entry.signedUrl);
  }
  return map;
}

async function requireManager(context: { supabase: any; userId: string }) {
  const { data: profile } = await context.supabase.rpc("current_profile");
  const row = Array.isArray(profile) ? profile[0] : profile;
  const role = String(row?.role ?? "").toLowerCase();
  if (!row?.active || !MANAGE_ROLES.includes(role)) {
    throw new Error("Du darfst keine Fotos verwalten.");
  }
  return row;
}

export const listMachinePhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ machineId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("machine_photos")
      .select("id, storage_path, is_primary, created_at")
      .eq("machine_id", data.machineId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error("Fotos konnten nicht geladen werden.");

    const photos = rows ?? [];
    if (photos.length === 0) return [];

    const paths = photos.flatMap((p: { storage_path: string }) => [
      p.storage_path,
      thumbPathFor(p.storage_path),
    ]);
    const { data: signed } = await context.supabase.storage
      .from(BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL);
    const urls = signedUrlMap(signed);

    return photos.map((p: { id: string; storage_path: string; is_primary: boolean }) => ({
      id: p.id,
      isPrimary: p.is_primary,
      url: urls.get(p.storage_path) ?? null,
      thumbUrl: urls.get(thumbPathFor(p.storage_path)) ?? urls.get(p.storage_path) ?? null,
    }));
  });

/**
 * Hauptbild je Maschine für Listen und den Gerätepass.
 * Defensiv: gibt es kein als Hauptbild markiertes Foto, wird das älteste
 * vorhandene Foto verwendet. Fehlt das Thumbnail im Storage, wird auf das
 * Originalbild zurückgefallen — so entsteht nie ein falscher Leerzustand.
 */
export const primaryPhotoUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        machineIds: z.array(z.string().uuid()).max(200),
        variant: z.enum(["thumb", "full"]).default("thumb"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.machineIds.length === 0) return {} as Record<string, string>;

    const { data: rows, error } = await context.supabase
      .from("machine_photos")
      .select("machine_id, storage_path, is_primary, created_at")
      .in("machine_id", data.machineIds)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[machine-photos] primary lookup failed", error);
      return {} as Record<string, string>;
    }

    type Row = {
      machine_id: string;
      storage_path: string;
      is_primary: boolean;
      created_at: string;
    };
    const chosen = new Map<string, Row>();
    for (const row of (rows ?? []) as Row[]) {
      if (!chosen.has(row.machine_id)) chosen.set(row.machine_id, row);
    }
    if (chosen.size === 0) return {} as Record<string, string>;

    const picks = [...chosen.values()];
    const paths = picks.flatMap((p) => [p.storage_path, thumbPathFor(p.storage_path)]);
    const { data: signed } = await context.supabase.storage
      .from(BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL);
    const urls = signedUrlMap(signed);

    const result: Record<string, string> = {};
    for (const p of picks) {
      const thumb = urls.get(thumbPathFor(p.storage_path));
      const full = urls.get(p.storage_path);
      const url = data.variant === "full" ? (full ?? thumb) : (thumb ?? full);
      if (url) result[p.machine_id] = url;
      else console.error("[machine-photos] no signed url for", p.storage_path);
    }
    return result;
  });

/**
 * Schritt 1: Der Server prüft Rolle und Limit, bestimmt den Zielpfad und
 * erzeugt kurzlebige Signed Upload URLs. Das Bild selbst lädt der Browser
 * direkt in den privaten Bucket — es läuft kein Bild-Payload durch die
 * Serverfunktion.
 */
export const createPhotoUploadTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        machineId: z.string().uuid(),
        extension: z.enum(["webp", "jpg"]).default("webp"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireManager(context as { supabase: any; userId: string });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("machine_photos")
      .select("id", { count: "exact", head: true })
      .eq("machine_id", data.machineId);
    if ((count ?? 0) >= MAX_PHOTOS) {
      throw new Error(`Maximal ${MAX_PHOTOS} Fotos je Maschine.`);
    }

    const path = `${data.machineId}/${crypto.randomUUID()}.${data.extension}`;
    const thumbPath = thumbPathFor(path);

    const main = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
    const thumb = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(thumbPath);
    if (main.error || thumb.error || !main.data || !thumb.data) {
      throw new Error("Upload konnte nicht vorbereitet werden.");
    }

    return {
      bucket: BUCKET,
      path,
      token: main.data.token,
      thumbPath,
      thumbToken: thumb.data.token,
    };
  });

/** Schritt 2: Nach erfolgreichem Storage-Upload den Datensatz anlegen. */
export const confirmMachinePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        machineId: z.string().uuid(),
        path: z.string().min(10).max(300),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireManager(context as { supabase: any; userId: string });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Pfad muss serverseitig zur Maschine gehören.
    if (!data.path.startsWith(`${data.machineId}/`)) {
      throw new Error("Ungültiger Upload-Pfad.");
    }

    const { count } = await supabaseAdmin
      .from("machine_photos")
      .select("id", { count: "exact", head: true })
      .eq("machine_id", data.machineId);
    if ((count ?? 0) >= MAX_PHOTOS) {
      await supabaseAdmin.storage.from(BUCKET).remove([data.path, thumbPathFor(data.path)]);
      throw new Error(`Maximal ${MAX_PHOTOS} Fotos je Maschine.`);
    }

    const { error } = await supabaseAdmin.from("machine_photos").insert({
      machine_id: data.machineId,
      storage_path: data.path,
      is_primary: (count ?? 0) === 0,
      uploaded_by: context.userId,
    });
    if (error) {
      await supabaseAdmin.storage.from(BUCKET).remove([data.path, thumbPathFor(data.path)]);
      throw new Error("Foto konnte nicht gespeichert werden.");
    }

    return { ok: true };
  });

export const setPrimaryMachinePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ photoId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireManager(context as { supabase: any; userId: string });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: photo } = await supabaseAdmin
      .from("machine_photos")
      .select("id, machine_id")
      .eq("id", data.photoId)
      .maybeSingle();
    if (!photo) throw new Error("Foto nicht gefunden.");

    await supabaseAdmin
      .from("machine_photos")
      .update({ is_primary: false })
      .eq("machine_id", photo.machine_id);
    const { error } = await supabaseAdmin
      .from("machine_photos")
      .update({ is_primary: true })
      .eq("id", photo.id);
    if (error) throw new Error("Hauptbild konnte nicht gesetzt werden.");

    return { ok: true };
  });

export const deleteMachinePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ photoId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireManager(context as { supabase: any; userId: string });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: photo } = await supabaseAdmin
      .from("machine_photos")
      .select("id, machine_id, storage_path, is_primary")
      .eq("id", data.photoId)
      .maybeSingle();
    if (!photo) throw new Error("Foto nicht gefunden.");

    const { error } = await supabaseAdmin.from("machine_photos").delete().eq("id", photo.id);
    if (error) throw new Error("Foto konnte nicht gelöscht werden.");

    await supabaseAdmin.storage
      .from(BUCKET)
      .remove([photo.storage_path, thumbPathFor(photo.storage_path)]);

    if (photo.is_primary) {
      const { data: next } = await supabaseAdmin
        .from("machine_photos")
        .select("id")
        .eq("machine_id", photo.machine_id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (next) {
        await supabaseAdmin.from("machine_photos").update({ is_primary: true }).eq("id", next.id);
      }
    }

    return { ok: true };
  });
