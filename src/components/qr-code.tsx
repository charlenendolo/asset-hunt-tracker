import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Printer, QrCode as QrIcon, Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { appBaseUrl, isTemporaryBaseUrl, machineQrUrl } from "@/lib/app-url";

function useQrDataUrl(value: string, size: number) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!value) return;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#101828", light: "#FFFFFF" },
    })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc(null);
      });
    return () => {
      active = false;
    };
  }, [value, size]);
  return src;
}

export function QrImage({
  value,
  size = 220,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const src = useQrDataUrl(value, size * 2);
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

/** Printable equipment label — opened in a separate window so app styles never
 * interfere with label geometry. */
function printLabel(machine: Machine, qrDataUrl: string, url: string) {
  const win = window.open("", "_blank", "width=520,height=680");
  if (!win) return;
  win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8" />
<title>Etikett ${machine.asset_code}</title>
<style>
  @page { margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: Inter, -apple-system, "Segoe UI", sans-serif; margin: 0; color: #101828; }
  .label { width: 62mm; border: 1px solid #101828; border-radius: 3mm; padding: 4mm; text-align: center; }
  .brand { font-size: 9pt; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: #1E5A4B; }
  .qr { width: 38mm; height: 38mm; margin: 3mm auto 2mm; display: block; }
  .name { font-size: 11pt; font-weight: 600; line-height: 1.2; }
  .code { font-size: 13pt; font-weight: 700; letter-spacing: .04em; margin-top: 1mm; }
  .hint { font-size: 7.5pt; margin-top: 2mm; color: #475467; }
</style></head><body>
<div class="label">
  <div class="brand">Repenning Geräteportal</div>
  <img class="qr" src="${qrDataUrl}" alt="QR-Code" />
  <div class="name">${machine.name.replace(/[<>&]/g, "")}</div>
  <div class="code">${machine.asset_code.replace(/[<>&]/g, "")}</div>
  <div class="hint">Scannen zum Ausleihen / Zurückgeben</div>
</div>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };<\/script>
</body></html>`);
  win.document.close();
  void url;
}

export function MachineQrSection({ machine }: { machine: Machine }) {
  const [open, setOpen] = useState(false);
  const url = machineQrUrl(machine.id);
  const printSrc = useQrDataUrl(url, 600);
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
          <QrImage value={url} size={128} />
        </button>

        <div className="min-w-0 flex-1 space-y-3">
          <p className="break-all text-xs text-muted-foreground">{url}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <Maximize2 className="mr-2 h-4 w-4" /> Vergrößern
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!printSrc}
              onClick={() => printSrc && printLabel(machine, printSrc, url)}
            >
              <Printer className="mr-2 h-4 w-4" /> Etikett drucken
            </Button>
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
              <QrImage value={url} size={240} />
            </div>
            <p className="break-all text-center text-xs text-muted-foreground">{url}</p>
            <Button
              className="w-full"
              disabled={!printSrc}
              onClick={() => printSrc && printLabel(machine, printSrc, url)}
            >
              <Printer className="mr-2 h-4 w-4" /> Etikett drucken
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <p className="sr-only">{appBaseUrl()}</p>
    </section>
  );
}
