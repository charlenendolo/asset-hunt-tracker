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

const thumbPathFor = (path: string) => path.replace(/\.webp$/, "_thumb.webp");

async function requireManager(context: { supabase: any; userId: string }) {
  const { data: profile } = await context.supabase.rpc("current_profile");
  const row = Array.isArray(profile) ? profile[0] : profile;
  const role = String(row?.role ?? "").toLowerCase();
  if (!row?.active || !MANAGE_ROLES.includes(role)) {
    throw new Error("Du darfst keine Fotos verwalten.");
  }
  return row;
}

function decodeDataUrl(value: string) {
  const base64 = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
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
    const urls = new Map<string, string>(
      (signed ?? [])
        .filter((s: { signedUrl: string | null }) => s.signedUrl)
        .map((s: { path: string | null; signedUrl: string }) => [s.path ?? "", s.signedUrl]),
    );

    return photos.map((p: { id: string; storage_path: string; is_primary: boolean }) => ({
      id: p.id,
      isPrimary: p.is_primary,
      url: urls.get(p.storage_path) ?? null,
      thumbUrl: urls.get(thumbPathFor(p.storage_path)) ?? urls.get(p.storage_path) ?? null,
    }));
  });

/** Hauptbild-Thumbnails für Listen (Maschinenliste, Meine Geräte, QR-Ansicht). */
export const primaryPhotoUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ machineIds: z.array(z.string().uuid()).max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.machineIds.length === 0) return {} as Record<string, string>;

    const { data: rows } = await context.supabase
      .from("machine_photos")
      .select("machine_id, storage_path, is_primary")
      .in("machine_id", data.machineIds)
      .eq("is_primary", true);

    const photos = rows ?? [];
    if (photos.length === 0) return {} as Record<string, string>;

    const { data: signed } = await context.supabase.storage
      .from(BUCKET)
      .createSignedUrls(
        photos.map((p: { storage_path: string }) => thumbPathFor(p.storage_path)),
        SIGNED_URL_TTL,
      );
    const urls = new Map<string, string>(
      (signed ?? [])
        .filter((s: { signedUrl: string | null }) => s.signedUrl)
        .map((s: { path: string | null; signedUrl: string }) => [s.path ?? "", s.signedUrl]),
    );

    const result: Record<string, string> = {};
    for (const p of photos as { machine_id: string; storage_path: string }[]) {
      const url = urls.get(thumbPathFor(p.storage_path));
      if (url) result[p.machine_id] = url;
    }
    return result;
  });

export const uploadMachinePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        machineId: z.string().uuid(),
        image: z.string().min(100).max(1_600_000),
        thumbnail: z.string().min(50).max(600_000),
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

    const id = crypto.randomUUID();
    const path = `${data.machineId}/${id}.webp`;

    const main = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, decodeDataUrl(data.image), { contentType: "image/webp", upsert: true });
    if (main.error) throw new Error("Foto konnte nicht hochgeladen werden.");

    await supabaseAdmin.storage
      .from(BUCKET)
      .upload(thumbPathFor(path), decodeDataUrl(data.thumbnail), {
        contentType: "image/webp",
        upsert: true,
      });

    const { error } = await supabaseAdmin.from("machine_photos").insert({
      machine_id: data.machineId,
      storage_path: path,
      is_primary: (count ?? 0) === 0,
      uploaded_by: context.userId,
    });
    if (error) {
      await supabaseAdmin.storage.from(BUCKET).remove([path, thumbPathFor(path)]);
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
