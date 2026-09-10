import { useEffect, useRef, useState } from "react";
import { ImageOff, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { listMachinePhotos } from "@/lib/machine-photos.functions";

type Photo = { id: string; url: string | null };

/** Alle Fotos einer Maschine — gleicher Query-Key wie die Fotoverwaltung. */
function useMachineGallery(machineId?: string) {
  const list = useServerFn(listMachinePhotos);
  const query = useQuery({
    queryKey: ["machine-photos", machineId],
    enabled: !!machineId,
    staleTime: 5 * 60 * 1000,
    queryFn: () => list({ data: { machineId: machineId! } }),
  });
  return ((query.data ?? []) as Photo[]).filter((p) => !!p.url);
}

/**
 * Großes Hauptbild im Gerätepass: immer vollständig sichtbar (object-contain),
 * zentriert, mit neutraler Hintergrundfläche. Klick öffnet eine Lightbox.
 * Bei mehreren Fotos wird daraus eine wischbare Galerie.
 */
export function MachineHeroPhoto({
  src,
  alt,
  machineId,
  className,
}: {
  src?: string | undefined;
  alt: string;
  machineId?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const photos = useMachineGallery(machineId);
  const urls = photos.length > 0 ? photos.map((p) => p.url as string) : src ? [src] : [];
  const count = urls.length;
  const active = Math.min(index, Math.max(count - 1, 0));

  useEffect(() => {
    if (index > count - 1) setIndex(0);
  }, [count, index]);

  const scrollTo = (next: number) => {
    const el = trackRef.current;
    if (!el) return;
    const clamped = (next + count) % count;
    el.scrollTo({ left: el.clientWidth * clamped, behavior: "smooth" });
    setIndex(clamped);
  };

  if (count === 0) {
    return (
      <div
        className={cn(
          "grid aspect-[16/9] w-full place-items-center bg-muted text-muted-foreground",
          className,
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <ImageOff className="h-7 w-7" strokeWidth={1.5} />
          <p className="text-xs">Kein Foto hinterlegt</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={cn("relative w-full bg-muted/60", className)}>
        <div
          ref={trackRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.clientWidth > 0) setIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          // pan-x: horizontales Wischen zwischen Fotos; pan-y: Seite bleibt vertikal scrollbar.
          style={{ touchAction: "pan-x pan-y pinch-zoom" }}
        >
          {urls.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setOpen(true)}
              aria-label={`Foto ${i + 1} von ${count} in Vollbild öffnen`}
              className="w-full flex-none snap-center cursor-zoom-in"
            >
              <img
                src={url}
                alt={count > 1 ? `${alt} – Foto ${i + 1} von ${count}` : alt}
                className="mx-auto aspect-[16/9] max-w-full object-contain"
                draggable={false}
              />
            </button>
          ))}
        </div>

        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => scrollTo(active - 1)}
              aria-label="Vorheriges Foto"
              className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full border border-border bg-background/80 p-1.5 text-foreground shadow-sm transition-colors hover:bg-background sm:block"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollTo(active + 1)}
              aria-label="Nächstes Foto"
              className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full border border-border bg-background/80 p-1.5 text-foreground shadow-sm transition-colors hover:bg-background sm:block"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <span className="absolute right-2 top-2 rounded-full bg-foreground/70 px-2 py-0.5 text-[11px] font-medium text-background">
              {active + 1} / {count}
            </span>

            <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
              {urls.map((url, i) => (
                <span
                  key={url}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-opacity",
                    i === active ? "bg-foreground" : "bg-foreground/30",
                  )}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] border-0 bg-background/95 p-2 sm:max-w-3xl">
          <DialogTitle className="sr-only">{alt}</DialogTitle>

          <div className="relative">
            <div
              ref={lightboxRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.clientWidth > 0) setIndex(Math.round(el.scrollLeft / el.clientWidth));
              }}
              className="flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ touchAction: "pan-x pan-y pinch-zoom" }}
            >
              {urls.map((url, i) => (
                <img
                  key={url}
                  src={url}
                  alt={count > 1 ? `${alt} – Foto ${i + 1} von ${count}` : alt}
                  className="max-h-[85vh] w-full flex-none snap-center object-contain"
                  draggable={false}
                />
              ))}
            </div>

            {count > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => scrollTo(active - 1, lightboxRef)}
                  aria-label="Vorheriges Foto"
                  className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full border border-border bg-background/80 p-1.5 text-foreground shadow-sm transition-colors hover:bg-background sm:block"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollTo(active + 1, lightboxRef)}
                  aria-label="Nächstes Foto"
                  className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full border border-border bg-background/80 p-1.5 text-foreground shadow-sm transition-colors hover:bg-background sm:block"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-foreground/70 px-2 py-0.5 text-[11px] font-medium text-background">
                  {active + 1} / {count}
                </span>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
