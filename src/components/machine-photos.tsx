import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImageOff, Loader2, Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useIdentity } from "@/hooks/use-identity";
import { prepareMachinePhoto } from "@/lib/image-compress";
import { supabase } from "@/integrations/supabase/client";
import {
  confirmMachinePhoto,
  createPhotoUploadTicket,
  deleteMachinePhoto,
  listMachinePhotos,
  setPrimaryMachinePhoto,
} from "@/lib/machine-photos.functions";

const MAX_PHOTOS = 8;

/** Fotogalerie im Gerätepass. Verwalten dürfen nur Admin und Bauleiter. */
export function MachinePhotos({ machineId }: { machineId: string }) {
  const identity = useIdentity();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const list = useServerFn(listMachinePhotos);
  const createTicket = useServerFn(createPhotoUploadTicket);
  const confirmPhoto = useServerFn(confirmMachinePhoto);
  const remove = useServerFn(deleteMachinePhoto);
  const setPrimary = useServerFn(setPrimaryMachinePhoto);

  const photos = useQuery({
    queryKey: ["machine-photos", machineId],
    queryFn: () => list({ data: { machineId } }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["machine-photos"] });
    void queryClient.invalidateQueries({ queryKey: ["machine-primary-photos"] });
  };

  const removeMutation = useMutation({
    mutationFn: (photoId: string) => remove({ data: { photoId } }),
    onSuccess: () => {
      toast.success("Foto gelöscht.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const primaryMutation = useMutation({
    mutationFn: (photoId: string) => setPrimary({ data: { photoId } }),
    onSuccess: () => {
      toast.success("Hauptbild aktualisiert.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const remaining = MAX_PHOTOS - (photos.data?.length ?? 0);
    if (remaining <= 0) {
      toast.error(`Maximal ${MAX_PHOTOS} Fotos je Maschine.`);
      return;
    }
    setBusy(true);
    try {
      for (const file of Array.from(files).slice(0, remaining)) {
        const prepared = await prepareMachinePhoto(file);
        const ticket = await createTicket({
          data: { machineId, extension: prepared.extension },
        });

        const main = await supabase.storage
          .from(ticket.bucket)
          .uploadToSignedUrl(ticket.path, ticket.token, prepared.image, {
            contentType: prepared.contentType,
            upsert: true,
          });
        if (main.error) throw new Error("Foto konnte nicht hochgeladen werden.");

        await supabase.storage
          .from(ticket.bucket)
          .uploadToSignedUrl(ticket.thumbPath, ticket.thumbToken, prepared.thumbnail, {
            contentType: prepared.contentType,
            upsert: true,
          });

        await confirmPhoto({ data: { machineId, path: ticket.path } });
      }
      toast.success("Foto wurde hochgeladen.");
      invalidate();
    } catch (error) {
      console.error("[machine-photos] upload failed", error);
      const message = (error as Error)?.message ?? "";
      toast.error(
        message && message.length < 160 && !message.startsWith("{")
          ? message
          : "Foto konnte nicht hochgeladen werden. Bitte versuche es erneut.",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const items = photos.data ?? [];

  return (
    <div className="space-y-3">
      {photos.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : items.length === 0 ? (
        <EmptyState
          className="border-0 py-8"
          icon={<ImageOff className="h-5 w-5" strokeWidth={1.5} />}
          title="Noch keine Fotos hinterlegt."
        />
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {items.map((p) => (
            <li key={p.id} className="group relative overflow-hidden rounded-md border border-border">
              {p.thumbUrl ? (
                <img
                  src={p.thumbUrl}
                  alt="Gerätefoto"
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="grid aspect-square w-full place-items-center bg-muted text-muted-foreground">
                  <ImageOff className="h-4 w-4" strokeWidth={1.5} />
                </div>
              )}
              {p.isPrimary ? (
                <span className="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                  Hauptbild
                </span>
              ) : null}
              {identity.canManage ? (
                <div className="absolute inset-x-1 bottom-1 flex justify-end gap-1">
                  {!p.isPrimary ? (
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7"
                      aria-label="Als Hauptbild festlegen"
                      disabled={primaryMutation.isPending}
                      onClick={() => primaryMutation.mutate(p.id)}
                    >
                      <Star className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-7 w-7"
                    aria-label="Foto löschen"
                    disabled={removeMutation.isPending}
                    onClick={() => removeMutation.mutate(p.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {identity.canManage ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {items.length}/{MAX_PHOTOS} Fotos
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <Button
            variant="outline"
            className="h-9"
            disabled={busy || items.length >= MAX_PHOTOS}
            aria-busy={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" strokeWidth={1.75} />
            )}
            {busy ? "Wird hochgeladen …" : "Foto hochladen"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
