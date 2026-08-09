import { useMemo, useState } from "react";
import { Printer, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MachineQrLabel } from "@/components/machine-qr-label";
import { useMachineQrSvgs } from "@/hooks/use-machine-qr";
import {
  LABEL_FORMATS,
  PRINT_MODE_LABELS,
  getMachineQrUrl,
  isPrintable,
  labelMarkup,
  labelName,
  printLabels,
  qrFileName,
  type LabelFormat,
  type LabelMachine,
  type PrintMode,
} from "@/lib/qr-labels";
import { cn } from "@/lib/utils";

function OptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-foreground/80 hover:bg-accent/50",
      )}
    >
      {children}
    </button>
  );
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Vorschau + Druck für ein oder mehrere Etiketten.
 * Gedruckt wird ausschließlich über ein separates Druckfenster, damit weder
 * Navigation, Buttons noch Dialog-Hintergrund im Ausdruck erscheinen.
 */
export function LabelPrintDialog({
  machines,
  open,
  onOpenChange,
}: {
  machines: LabelMachine[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [format, setFormat] = useState<LabelFormat>("standard");
  const [mode, setMode] = useState<PrintMode>("labelprinter");

  const printable = useMemo(() => machines.filter(isPrintable), [machines]);
  const incomplete = useMemo(() => machines.filter((m) => !isPrintable(m)), [machines]);
  const single = machines.length === 1 ? machines[0] : undefined;

  const ids = useMemo(
    () => (open ? printable.slice(0, 500).map((m) => m.id) : []),
    [open, printable],
  );
  const { svgs, failed, isLoading } = useMachineQrSvgs(ids);

  const ready = printable.filter((m) => svgs[m.id]);
  const preview = ready.slice(0, 12);

  function handlePrint() {
    if (ready.length === 0) {
      toast.error("Keine druckbaren Etiketten vorhanden.");
      return;
    }
    const ok = printLabels(
      ready.map((m) => labelMarkup(m, format, svgs[m.id]!)),
      format,
      mode,
    );
    if (!ok) {
      toast.error("Druckfenster wurde blockiert. Bitte Pop-ups für diese Seite erlauben.");
      return;
    }
    toast.success(`${ready.length} Etikett${ready.length === 1 ? "" : "en"} an den Druck übergeben.`);
  }

  function handleDownloadSvg() {
    if (!single || !svgs[single.id]) return;
    download(qrFileName(single, "svg"), new Blob([svgs[single.id]!], { type: "image/svg+xml" }));
  }

  async function handleDownloadPng() {
    if (!single || !svgs[single.id]) return;
    try {
      const { default: QRCode } = await import("qrcode");
      const dataUrl = await QRCode.toDataURL(getMachineQrUrl(single.id), {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#FFFFFF" },
      });
      const res = await fetch(dataUrl);
      download(qrFileName(single, "png"), await res.blob());
    } catch {
      toast.error("PNG konnte nicht erzeugt werden.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Etiketten drucken</DialogTitle>
          <DialogDescription>
            {single
              ? `${labelName(single)} · ${single.asset_code ?? "ohne Gerätenummer"}`
              : `${machines.length} Maschinen ausgewählt`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Format</p>
            <div className="flex flex-wrap gap-2">
              {Object.values(LABEL_FORMATS).map((f) => (
                <OptionButton
                  key={f.key}
                  active={format === f.key}
                  onClick={() => setFormat(f.key)}
                >
                  {f.label}
                </OptionButton>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Druckmodus</p>
            <div className="flex flex-wrap gap-2">
              <OptionButton
                active={mode === "labelprinter"}
                onClick={() => setMode("labelprinter")}
              >
                {PRINT_MODE_LABELS.labelprinter}
              </OptionButton>
              <OptionButton active={mode === "a4"} onClick={() => setMode("a4")}>
                Auf A4-Bogen drucken
              </OptionButton>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p>
              Etiketten: <span className="font-medium text-foreground">{ready.length}</span> ·
              Format:{" "}
              <span className="font-medium text-foreground">{LABEL_FORMATS[format].label}</span> ·
              Druckmodus:{" "}
              <span className="font-medium text-foreground">{PRINT_MODE_LABELS[mode]}</span>
            </p>
            {single ? (
              <p className="mt-1 break-all">Ziel-URL: {getMachineQrUrl(single.id)}</p>
            ) : null}
          </div>

          {incomplete.length > 0 ? (
            <div className="rounded-lg border border-status-defect/40 bg-status-defect/10 p-3 text-xs">
              <p className="flex items-center gap-1.5 font-medium text-status-defect">
                <AlertTriangle className="h-3.5 w-3.5" /> {incomplete.length} Gerät
                {incomplete.length === 1 ? "" : "e"} ohne Gerätenummer – wird nicht gedruckt.
              </p>
              <ul className="mt-1 list-inside list-disc text-muted-foreground">
                {incomplete.slice(0, 8).map((m) => (
                  <li key={m.id}>{labelName(m)}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {failed.length > 0 ? (
            <p className="text-xs text-status-defect">
              {failed.length} QR-Code konnte nicht erzeugt werden.
            </p>
          ) : null}

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Vorschau {ready.length > preview.length ? `(erste ${preview.length})` : ""}
            </p>
            <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-white p-3">
              {isLoading && preview.length === 0 ? (
                <p className="text-xs text-muted-foreground">QR-Codes werden erzeugt …</p>
              ) : preview.length === 0 ? (
                <p className="text-xs text-muted-foreground">Keine druckbaren Etiketten.</p>
              ) : (
                preview.map((m) => (
                  <MachineQrLabel key={m.id} machine={m} format={format} qrSvg={svgs[m.id]} />
                ))
              )}
            </div>
          </div>

          {single ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!svgs[single.id]}
                onClick={handleDownloadSvg}
              >
                <Download className="mr-2 h-4 w-4" /> QR-Code als SVG
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!svgs[single.id]}
                onClick={() => void handleDownloadPng()}
              >
                <Download className="mr-2 h-4 w-4" /> PNG
              </Button>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handlePrint} disabled={ready.length === 0}>
            <Printer className="mr-2 h-4 w-4" /> Drucken
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Einzeldruck aus dem Gerätepass — öffnet immer zuerst die Vorschau. */
export function PrintLabelButton({
  machine,
  className,
  variant = "outline",
  size = "sm",
}: {
  machine: LabelMachine;
  className?: string;
  variant?: "outline" | "default";
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <Printer className="mr-2 h-4 w-4" /> Etikett drucken
      </Button>
      <LabelPrintDialog machines={[machine]} open={open} onOpenChange={setOpen} />
    </>
  );
}
