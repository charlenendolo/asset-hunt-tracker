import { useEffect } from "react";

import {
  LABEL_CSS,
  LABEL_FORMATS,
  labelMarkup,
  type LabelFormat,
  type LabelMachine,
} from "@/lib/qr-labels";
import { cn } from "@/lib/utils";

let styleMounted = false;

/** Label-Styles einmalig im Dokument bereitstellen (Vorschau). */
function useLabelStyles() {
  useEffect(() => {
    if (styleMounted || typeof document === "undefined") return;
    const el = document.createElement("style");
    el.dataset["ahLabel"] = "true";
    el.textContent = LABEL_CSS;
    document.head.appendChild(el);
    styleMounted = true;
  }, []);
}

/**
 * Physisches Etikett — identisches Markup wie im Druck, damit Vorschau,
 * Einzeldruck, Stapeldruck und A4-Bogen niemals auseinanderlaufen.
 */
export function MachineQrLabel({
  machine,
  format,
  qrSvg,
  className,
}: {
  machine: LabelMachine;
  format: LabelFormat;
  qrSvg: string | undefined;
  className?: string;
}) {
  useLabelStyles();
  const { widthMm, heightMm } = LABEL_FORMATS[format];

  if (!qrSvg) {
    return (
      <div
        className={cn("rounded-sm border border-border bg-muted", className)}
        style={{ width: `${widthMm}mm`, height: `${heightMm}mm` }}
        aria-label="QR-Code wird erzeugt"
      />
    );
  }

  return (
    <div
      className={cn("border border-border", className)}
      dangerouslySetInnerHTML={{ __html: labelMarkup(machine, format, qrSvg) }}
    />
  );
}
