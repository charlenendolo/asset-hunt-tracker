import { useEffect, useMemo, useState } from "react";
import { Printer, Download, AlertTriangle, ArrowLeft } from "lucide-react";
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
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-foreground/80 hover:bg-accent/50",
      )}
    >
      <span className="block text-sm font-medium">{title}</span>
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
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

export async function downloadQrSvg(machine: LabelMachine, svg: string) {
  download(qrFileName(machine, "svg"), new Blob([svg], { type: "image/svg+xml" }));
}

export async function downloadQrPng(machine: LabelMachine) {
  const { default: QRCode } = await import("qrcode");
  const dataUrl = await QRCode.toDataURL(getMachineQrUrl(machine.id), {
    width: 1024,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
  const res = await fetch(dataUrl);
  download(qrFileName(machine, "png"), await res.blob());
}

type Step = "format" | "mode" | "preview";

/**
 * Admin-Workflow: Format → Druckmodus → Vorschau → Drucken.
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
  const [step, setStep] = useState<Step>("format");

  useEffect(() => {
    if (open) setStep("format");
  }, [open]);

  const printable = useMemo(() => machines.filter(isPrintable), [machines]);
  const incomplete = useMemo(() => machines.filter((m) => !isPrintable(m)), [machines]);
  const single = machines.length === 1 ? machines[0] : undefined;

  // QR-Codes erst erzeugen, wenn die Vorschau wirklich gebraucht wird.
  const ids = useMemo(
    () => (open && step === "preview" ? printable.slice(0, 1000).map((m) => m.id) : []),
    [open, step, printable],
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
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">{machines.length}</span> Maschine
              {machines.length === 1 ? "" : "n"} ausgewählt ·{" "}
              <span className="font-medium text-foreground">{printable.length}</span> Etikett
              {printable.length === 1 ? "" : "en"} druckbereit
              {incomplete.length > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-medium text-status-defect">
                    {incomplete.length} ohne Gerätenummer
                  </span>
                </>
              ) : null}
            </p>
            {single ? (
              <p className="mt-1 break-all">Ziel-URL: {getMachineQrUrl(single.id)}</p>
            ) : null}
          </div>

          {incomplete.length > 0 ? (
            <div className="rounded-lg border border-status-defect/40 bg-status-defect/10 p-3 text-xs">
              <p className="flex items-center gap-1.5 font-medium text-status-defect">
                <AlertTriangle className="h-3.5 w-3.5" /> Gerätenummer fehlt – wird nicht gedruckt.
              </p>
              <ul className="mt-1 list-inside list-disc text-muted-foreground">
                {incomplete.slice(0, 8).map((m) => (
                  <li key={m.id}>{labelName(m)}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {step === "format" ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Etikettenformat</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                {Object.values(LABEL_FORMATS).map((f) => (
                  <OptionButton
                    key={f.key}
                    active={format === f.key}
                    onClick={() => setFormat(f.key)}
                    title={f.label}
                    hint={f.hint}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {step === "mode" ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Druckmodus</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <OptionButton
                  active={mode === "labelprinter"}
                  onClick={() => setMode("labelprinter")}
                  title={PRINT_MODE_LABELS.labelprinter}
                  hint="Endlos-Etikettenband, ein Etikett pro Seite"
                />
                <OptionButton
                  active={mode === "a4"}
                  onClick={() => setMode("a4")}
                  title="A4-Bogen"
                  hint="Raster für normale Bürodrucker"
                />
              </div>
            </div>
          ) : null}

          {step === "preview" ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Druckvorschau · {ready.length} Etikett{ready.length === 1 ? "" : "en"} ·{" "}
                {LABEL_FORMATS[format].label} · {PRINT_MODE_LABELS[mode]}
                {ready.length > preview.length ? ` (erste ${preview.length} dargestellt)` : ""}
              </p>
              <div className="flex flex-wrap gap-3 overflow-x-auto rounded-lg border border-border bg-white p-3">
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
              {failed.length > 0 ? (
                <p className="mt-2 text-xs text-status-defect">
                  {failed.length} QR-Code konnte nicht erzeugt werden.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          {step === "format" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button onClick={() => setStep("mode")} disabled={printable.length === 0}>
                Weiter
              </Button>
            </>
          ) : step === "mode" ? (
            <>
              <Button variant="outline" onClick={() => setStep("format")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Zurück
              </Button>
              <Button onClick={() => setStep("preview")}>Druckvorschau</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("mode")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Zurück
              </Button>
              <Button onClick={handlePrint} disabled={ready.length === 0}>
                <Printer className="mr-2 h-4 w-4" /> Drucken
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Einzeldruck-Shortcut (nur Admin) — öffnet immer zuerst die Vorschau. */
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

/** Einzelner QR-Download (SVG/PNG) — bewusst getrennt vom Etikettendruck. */
export function QrDownloadButtons({
  machine,
  svg,
}: {
  machine: LabelMachine;
  svg: string | undefined;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={!svg}
        onClick={() => void downloadQrSvg(machine, svg!)}
      >
        <Download className="mr-2 h-4 w-4" /> QR-Code herunterladen (SVG)
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          void downloadQrPng(machine).catch(() => toast.error("PNG konnte nicht erzeugt werden."))
        }
      >
        <Download className="mr-2 h-4 w-4" /> PNG
      </Button>
    </div>
  );
}
