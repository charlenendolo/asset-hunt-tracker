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
import { generateMachineQrPng, useMachineQrPngs } from "@/hooks/use-machine-qr";
import { renderLabelPng } from "@/lib/label-png";
import {
  LABEL_FORMATS,
  PRINT_MODE_LABELS,
  getMachineQrUrl,
  isPrintable,
  labelMarkup,
  labelName,
  printLabels,
  labelFileName,
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

async function downloadLabelPng(machine: LabelMachine) {
  const qrPng = await generateMachineQrPng(machine.id);
  const labelPng = await renderLabelPng(machine, "standard", qrPng);
  download(labelFileName(machine, "png"), labelPng);
}

const FORMAT: LabelFormat = "standard";

/**
 * Stapeldruck: Auswahl → Vorschau → Drucken. Ein Gerät ergibt exakt ein
 * Etikett und im Etikettendrucker-Modus exakt eine Druckseite.
 * Gedruckt wird über ein separates Fenster, damit weder App-Navigation
 * noch Dialog-Styles im Ausdruck landen.
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
  const [mode, setMode] = useState<PrintMode>("labelprinter");
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);

  const printable = useMemo(() => machines.filter(isPrintable), [machines]);
  const incomplete = useMemo(() => machines.filter((m) => !isPrintable(m)), [machines]);
  const single = machines.length === 1 ? machines[0] : undefined;

  // QR-Codes erst erzeugen, wenn der Dialog offen ist (Cache verhindert Doppelarbeit).
  const ids = useMemo(() => (open ? printable.map((m) => m.id) : []), [open, printable]);
  const { pngs, failed, isLoading } = useMachineQrPngs(ids);

  const ready = printable.filter((m) => pngs[m.id]);
  const allReady = !isLoading && ready.length === printable.length;

  function handlePrint() {
    if (!allReady) {
      toast.error("Die QR-Codes werden noch erzeugt. Bitte kurz warten.");
      return;
    }
    if (ready.length === 0) {
      toast.error("Keine druckbaren Etiketten vorhanden.");
      return;
    }
    const labels = ready.flatMap((m) => {
      const png = pngs[m.id];
      return png ? [labelMarkup(m, FORMAT, png)] : [];
    });
    const ok = printLabels(labels, FORMAT, mode);
    if (!ok) {
      toast.error("Druckfenster wurde blockiert. Bitte Pop-ups für diese Seite erlauben.");
      return;
    }
    toast.success(
      `${ready.length} Etikett${ready.length === 1 ? "" : "en"} an den Druck übergeben.`,
    );
  }

  async function handleZip() {
    if (ready.length === 0) return;
    setZipProgress({ done: 0, total: ready.length });
    try {
      const zip = await buildLabelZip(ready, FORMAT, (done, total) => setZipProgress({ done, total }));
      download(`Etiketten_${ready.length}.zip`, zip);
      toast.success(`${ready.length} Etiketten als PNG-ZIP heruntergeladen.`);
    } catch {
      toast.error("Etiketten konnten nicht als ZIP erzeugt werden.");
    } finally {
      setZipProgress(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>QR-Etiketten drucken</DialogTitle>
          <DialogDescription>
            {single
              ? `${labelName(single)} · ${single.asset_code ?? "ohne Gerätenummer"}`
              : `${machines.length} Etiketten ausgewählt`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">{machines.length}</span> Gerät
              {machines.length === 1 ? "" : "e"} ausgewählt ·{" "}
              <span className="font-medium text-foreground">{printable.length}</span> Etikett
              {printable.length === 1 ? "" : "en"} · 62 mm · ein Gerät = ein Etikett = eine Seite
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

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Druckmodus</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <OptionButton
                active={mode === "labelprinter"}
                onClick={() => setMode("labelprinter")}
                title={PRINT_MODE_LABELS.labelprinter}
                hint="Eine Seite pro Etikett – Drucker kann dazwischen schneiden"
              />
              <OptionButton
                active={mode === "a4"}
                onClick={() => setMode("a4")}
                title="A4-Bogen"
                hint="Raster für normale Bürodrucker"
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Druckvorschau · {ready.length} von {printable.length} Etikett
              {printable.length === 1 ? "" : "en"} · {LABEL_FORMATS[FORMAT].label} ·{" "}
              {PRINT_MODE_LABELS[mode]}
            </p>
            <div className="max-h-[42vh] space-y-3 overflow-y-auto rounded-lg border border-border bg-white p-3">
              {isLoading && ready.length === 0 ? (
                <p className="text-xs text-muted-foreground">QR-Codes werden erzeugt …</p>
              ) : ready.length === 0 ? (
                <p className="text-xs text-muted-foreground">Keine druckbaren Etiketten.</p>
              ) : (
                ready.map((m, index) => (
                  <div key={m.id} className="flex items-center gap-3">
                    <span className="w-6 shrink-0 text-right text-[10px] text-neutral-400">
                      {index + 1}
                    </span>
                    <MachineQrLabel machine={m} format={FORMAT} qrPng={pngs[m.id]} />
                  </div>
                ))
              )}
              {isLoading && ready.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {ready.length} von {printable.length} Etiketten vorbereitet …
                </p>
              ) : null}
            </div>
          </div>

          {failed.length > 0 ? (
            <div className="text-xs text-status-defect">
              <p>{failed.length} QR-Code konnte nicht erzeugt werden:</p>
              <ul className="mt-1 list-inside list-disc">
                {printable
                  .filter((machine) => failed.includes(machine.id))
                  .slice(0, 8)
                  .map((machine) => (
                    <li key={machine.id}>{labelName(machine)}</li>
                  ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleZip()}
            disabled={!allReady || ready.length === 0 || zipProgress !== null}
          >
            <Download className="mr-2 h-4 w-4" />
            {zipProgress
              ? `PNG ${zipProgress.done}/${zipProgress.total} …`
              : ready.length > 1
                ? "Alle als PNG herunterladen"
                : "PNG herunterladen"}
          </Button>
          <Button onClick={handlePrint} disabled={!allReady || ready.length === 0}>
            <Printer className="mr-2 h-4 w-4" />
            {ready.length > 0
              ? `${ready.length} QR-Etikett${ready.length === 1 ? "" : "en"} drucken`
              : "Drucken"}
          </Button>
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

/** Vollständiges Standard-Etikett als druckfertiges, verlustfreies PNG. */
export function QrDownloadButtons({ machine }: { machine: LabelMachine }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          void downloadLabelPng(machine).catch(() =>
            toast.error("Etikett konnte nicht als PNG erzeugt werden."),
          )
        }
      >
        <Download className="mr-2 h-4 w-4" /> Etikett als PNG herunterladen
      </Button>
    </div>
  );
}
