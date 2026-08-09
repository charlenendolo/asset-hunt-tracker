import { useState } from "react";
import { ImageOff, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * Großes Hauptbild im Gerätepass: immer vollständig sichtbar (object-contain),
 * zentriert, mit neutraler Hintergrundfläche. Klick öffnet eine Lightbox.
 */
export function MachineHeroPhoto({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!src) {
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Foto in Vollbild öffnen"
        className={cn(
          "block w-full cursor-zoom-in bg-muted/60 transition-colors hover:bg-muted",
          className,
        )}
      >
        <img
          src={src}
          alt={alt}
          className="mx-auto aspect-[16/9] max-w-full object-contain"
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] border-0 bg-background/95 p-2 sm:max-w-3xl">
          <DialogTitle className="sr-only">{alt}</DialogTitle>

          <img
            src={src}
            alt={alt}
            className="max-h-[85vh] w-full object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
