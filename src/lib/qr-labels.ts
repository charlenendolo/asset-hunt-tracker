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

export type LabelFormat = "standard" | "compact";
export type PrintMode = "labelprinter" | "a4";

export const LABEL_FORMATS: Record<
  LabelFormat,
  { key: LabelFormat; label: string; hint: string; widthMm: number; heightMm: number }
> = {
  standard: {
    key: "standard",
    label: "Standard – 24 mm",
    hint: "QR + Maschinenname + Gerätenummer",
    widthMm: 62,
    heightMm: 24,
  },
  compact: {
    key: "compact",
    label: "Kompakt – 24 mm",
    hint: "QR + Gerätenummer",
    widthMm: 38,
    heightMm: 24,
  },
};

export const PRINT_MODE_LABELS: Record<PrintMode, string> = {
  labelprinter: "Etikettendrucker – 24 mm",
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
  display:flex;align-items:center;gap:1.6mm;overflow:hidden;break-inside:avoid;page-break-inside:avoid;}
.ah-label *{box-sizing:border-box;}
.ah-label--standard{width:62mm;height:24mm;padding:1.4mm 2mm;}
.ah-label--compact{width:38mm;height:24mm;padding:1.4mm 1.6mm;}
.ah-qr{flex:none;width:21mm;height:21mm;background:#fff;}
.ah-qr svg{display:block;width:100%;height:100%;shape-rendering:crispEdges;}
.ah-info{min-width:0;flex:1;display:flex;flex-direction:column;justify-content:center;gap:.7mm;}
.ah-name{font-size:8pt;line-height:1.1;font-weight:500;display:-webkit-box;-webkit-line-clamp:2;
  -webkit-box-orient:vertical;overflow:hidden;word-break:break-word;}
.ah-code{font-size:11pt;line-height:1;font-weight:700;letter-spacing:.03em;white-space:nowrap;}
.ah-label--compact .ah-code{font-size:10pt;}
.ah-brand{font-size:5pt;letter-spacing:.14em;text-transform:uppercase;font-weight:700;line-height:1;color:#333;}
`;

/** Reines Label-Markup (ohne Styles) — Basis für Vorschau, Einzel- und Stapeldruck. */
export function labelMarkup(
  machine: LabelMachine,
  format: LabelFormat,
  qrSvg: string,
): string {
  const code = escapeHtml((machine.asset_code ?? "").trim() || "OHNE NUMMER");
  const qr = `<div class="ah-qr">${qrSvg}</div>`;
  if (format === "compact") {
    return `<div class="ah-label ah-label--compact">${qr}
      <div class="ah-info"><div class="ah-code">${code}</div></div></div>`;
  }
  return `<div class="ah-label ah-label--standard">${qr}
    <div class="ah-info">
      <div class="ah-name">${escapeHtml(labelName(machine))}</div>
      <div class="ah-code">${code}</div>
      <div class="ah-brand">Repenning · Geräte</div>
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
