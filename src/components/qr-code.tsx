import { useEffect, useState } from "react";

import { QrCode as QrIcon, Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PrintLabelButton } from "@/components/label-print";
import { generateMachineQrPng } from "@/hooks/use-machine-qr";
import { isTemporaryBaseUrl } from "@/lib/app-url";
import { getMachineQrUrl } from "@/lib/qr-labels";

function useMachineQrPng(machineId: string) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!machineId) return;
    generateMachineQrPng(machineId)
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc(null);
      });
    return () => {
      active = false;
    };
  }, [machineId]);
  return src;
}

export function QrImage({
  machineId,
  size = 220,
  className,
}: {
  machineId: string;
  size?: number;
  className?: string;
}) {
  const src = useMachineQrPng(machineId);
  if (!src) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }
  return (
    <img
      src={src}
      alt="QR-Code zum Gerät"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, imageRendering: "pixelated" }}
    />
  );
}

type Machine = { id: string; name: string; asset_code: string };

export function MachineQrSection({ machine }: { machine: Machine }) {
  const [open, setOpen] = useState(false);
  const url = getMachineQrUrl(machine.id);
  const temporary = isTemporaryBaseUrl();

  return (
    <section className="rounded-xl border border-border bg-card px-5 py-4">
      <div className="flex items-center gap-2">
        <QrIcon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
        <h2 className="text-sm font-medium text-foreground">QR-Code</h2>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-border bg-white p-2"
          aria-label="QR-Code vergrößern"
        >
           <QrImage machineId={machine.id} size={128} />
        </button>

        <div className="min-w-0 flex-1 space-y-3">
          <p className="break-all text-xs text-muted-foreground">{url}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <Maximize2 className="mr-2 h-4 w-4" /> Vergrößern
            </Button>
            <PrintLabelButton machine={machine} />
          </div>
          {temporary ? (
            <p className="text-xs text-status-defect">
              Achtung: Aktuell wird eine temporäre Vorschau-Adresse kodiert. Für gedruckte
              Etiketten bitte <code>VITE_APP_BASE_URL</code> auf die Produktionsdomain setzen.
            </p>
          ) : null}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{machine.name}</DialogTitle>
            <DialogDescription>{machine.asset_code}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-xl border border-border bg-white p-4">
               <QrImage machineId={machine.id} size={240} />
            </div>
            <p className="break-all text-center text-xs text-muted-foreground">{url}</p>
            <PrintLabelButton machine={machine} className="w-full" variant="default" size="default" />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
