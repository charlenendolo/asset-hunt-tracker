/**
 * Etiketten- und QR-Logik für physische Gerätekennzeichnung.
 *
 * Das Etikett überlebt Jahre am Gerät: kodiert wird ausschließlich die
 * permanente Maschinen-URL (unveränderliche Datenbank-ID). Kein Status,
 * kein Nutzer, kein Standort, keine Tokens.
 */
import { machineQrUrl } from "@/lib/app-url";

/** Zentraler Helfer — jede QR-Erzeugung muss diesen verwenden. */
export const getMachineQrUrl = (machineId: string): string => machineQrUrl(machineId);

export type LabelFormat = "standard" | "small";
export type PrintMode = "labelprinter" | "a4";

export const LABEL_FORMATS: Record<
  LabelFormat,
  { key: LabelFormat; label: string; widthMm: number; heightMm: number }
> = {
  standard: { key: "standard", label: "Standard – 38 × 30 mm", widthMm: 38, heightMm: 30 },
  small: { key: "small", label: "Klein – 30 × 20 mm", widthMm: 30, heightMm: 20 },
};

export const PRINT_MODE_LABELS: Record<PrintMode, string> = {
  labelprinter: "Etikettendrucker",
  a4: "A4-Bogen",
};

export type LabelMachine = {
  id: string;
  name: string | null;
  asset_code: string | null;
};

export function labelName(machine: LabelMachine): string {
  const name = (machine.name ?? "").trim();
  return name || "Ohne Bezeichnung";
}

/** Geräte ohne Gerätenummer dürfen nicht still gedruckt werden. */
export function isPrintable(machine: LabelMachine): boolean {
  return !!(machine.asset_code ?? "").trim();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

/** Monochromes, industrielles Etikett — identisches Markup in Vorschau und Druck. */
export const LABEL_CSS = `
.ah-label{box-sizing:border-box;background:#fff;color:#000;font-family:Inter,Arial,Helvetica,sans-serif;
  display:flex;flex-direction:column;overflow:hidden;break-inside:avoid;page-break-inside:avoid;}
.ah-label *{box-sizing:border-box;}
.ah-label--standard{width:38mm;height:30mm;padding:1.6mm 1.8mm;}
.ah-label--small{width:30mm;height:20mm;padding:1.2mm 1.4mm;}
.ah-brand{font-size:4.6pt;letter-spacing:.12em;text-transform:uppercase;font-weight:700;line-height:1;}
.ah-body{display:flex;align-items:center;gap:1.6mm;flex:1;min-height:0;}
.ah-qr{flex:none;background:#fff;}
.ah-label--standard .ah-qr{width:19mm;height:19mm;}
.ah-label--small .ah-qr{width:15mm;height:15mm;}
.ah-qr svg{display:block;width:100%;height:100%;shape-rendering:crispEdges;}
.ah-info{min-width:0;flex:1;display:flex;flex-direction:column;justify-content:center;gap:.8mm;}
.ah-name{font-size:6.6pt;line-height:1.15;font-weight:500;display:-webkit-box;-webkit-line-clamp:3;
  -webkit-box-orient:vertical;overflow:hidden;word-break:break-word;}
.ah-code{font-size:9.5pt;line-height:1;font-weight:700;letter-spacing:.03em;white-space:nowrap;}
.ah-label--small .ah-code{font-size:8.5pt;}
.ah-label--small .ah-brand{font-size:3.8pt;}
`;

/** Reines Label-Markup (ohne Styles) — Basis für Vorschau, Einzel- und Stapeldruck. */
export function labelMarkup(
  machine: LabelMachine,
  format: LabelFormat,
  qrSvg: string,
): string {
  const code = escapeHtml((machine.asset_code ?? "").trim() || "OHNE NUMMER");
  const qr = `<div class="ah-qr">${qrSvg}</div>`;
  if (format === "small") {
    return `<div class="ah-label ah-label--small"><div class="ah-body">${qr}
      <div class="ah-info"><div class="ah-code">${code}</div></div></div></div>`;
  }
  return `<div class="ah-label ah-label--standard">
    <div class="ah-brand">Repenning</div>
    <div class="ah-body">${qr}
      <div class="ah-info">
        <div class="ah-name">${escapeHtml(labelName(machine))}</div>
        <div class="ah-code">${code}</div>
      </div>
    </div>
  </div>`;
}

export function sanitizeFilename(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[äÄ]/g, "ae")
    .replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function qrFileName(machine: LabelMachine, extension: "svg" | "png"): string {
  const code = sanitizeFilename((machine.asset_code ?? "geraet").trim() || "geraet");
  const name = sanitizeFilename(labelName(machine));
  return `${code}_${name}_QR.${extension}`;
}

/**
 * Standardbasierter Browserdruck — kein Druckertreiber ist fest verdrahtet.
 * Eigenes Fenster, damit weder App-Navigation noch Dialog-Styles im Druck landen.
 */
export function printLabels(
  labels: string[],
  format: LabelFormat,
  mode: PrintMode,
): boolean {
  if (labels.length === 0) return false;
  const win = window.open("", "_blank", "width=720,height=820");
  if (!win) return false;
  const { widthMm, heightMm } = LABEL_FORMATS[format];
  const page =
    mode === "labelprinter"
      ? `@page{size:${widthMm}mm ${heightMm}mm;margin:0;}
         .sheet{display:block;}
         .cell{page-break-after:always;break-after:page;}
         .cell:last-child{page-break-after:auto;break-after:auto;}`
      : `@page{size:A4 portrait;margin:8mm;}
         .sheet{display:flex;flex-wrap:wrap;gap:2mm;align-content:flex-start;}
         .cell{flex:none;}`;
  win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8" />
<title>Etiketten</title><style>
  html,body{margin:0;padding:0;background:#fff;}
  ${LABEL_CSS}
  ${page}
  @media print{ body{-webkit-print-color-adjust:exact;print-color-adjust:exact;} }
</style></head><body><div class="sheet">
${labels.map((l) => `<div class="cell">${l}</div>`).join("")}
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>
</body></html>`);
  win.document.close();
  return true;
}
