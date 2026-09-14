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

export type LabelFormat = "standard";
export type PrintMode = "labelprinter" | "a4";

export const LABEL_FORMATS: Record<
  LabelFormat,
  { key: LabelFormat; label: string; hint: string; widthMm: number; heightMm: number }
> = {
  standard: {
    key: "standard",
    label: "Standard – 62 mm",
    hint: "QR + Maschinenname + Gerätenummer",
    widthMm: 62,
    heightMm: 24,
  },
};

/**
 * Kanonische Maße der sichtbaren Standardvorlage. HTML-Druck und PNG-Export
 * leiten ihre Positionen ausschließlich hiervon ab.
 */
export const STANDARD_LABEL_DESIGN = {
  paddingYmm: 1.4,
  paddingXmm: 2,
  gapMm: 1.6,
  qrMm: 21,
  infoGapMm: 0.7,
  namePt: 8,
  nameLineHeight: 1.1,
  nameWeight: 500,
  codePt: 11,
  codeLineHeight: 1,
  codeWeight: 700,
  codeLetterSpacingEm: 0.03,
  brandPt: 5,
  brandLetterSpacingEm: 0.14,
  brandWeight: 700,
  brandColor: "#333333",
  brandText: "Repenning · Geräte",
} as const;

const PT_TO_MM = 25.4 / 72;

export const PRINT_MODE_LABELS: Record<PrintMode, string> = {
  labelprinter: "Etikettendrucker – 62 × 24 mm",
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
.ah-label{box-sizing:border-box;background:#fff;color:#000;overflow:hidden;break-inside:avoid;page-break-inside:avoid;}
.ah-label *{box-sizing:border-box;}
.ah-label--standard{width:${LABEL_FORMATS.standard.widthMm}mm;height:${LABEL_FORMATS.standard.heightMm}mm;}
.ah-label-svg{display:block;width:100%;height:100%;}
.ah-label-svg text{font-family:Inter,Arial,Helvetica,sans-serif;fill:#000;}
.ah-name{font-size:${STANDARD_LABEL_DESIGN.namePt * PT_TO_MM}mm;font-weight:${STANDARD_LABEL_DESIGN.nameWeight};}
.ah-code{font-size:${STANDARD_LABEL_DESIGN.codePt * PT_TO_MM}mm;line-height:${STANDARD_LABEL_DESIGN.codeLineHeight};font-weight:${STANDARD_LABEL_DESIGN.codeWeight};letter-spacing:${STANDARD_LABEL_DESIGN.codeLetterSpacingEm}em;white-space:nowrap;}
.ah-brand{font-size:${STANDARD_LABEL_DESIGN.brandPt * PT_TO_MM}mm;letter-spacing:${STANDARD_LABEL_DESIGN.brandLetterSpacingEm}em;text-transform:uppercase;font-weight:${STANDARD_LABEL_DESIGN.brandWeight};line-height:1;color:${STANDARD_LABEL_DESIGN.brandColor};}
`;

function labelNameLines(machine: LabelMachine): string[] {
  const words = labelName(machine).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || candidate.length <= 24) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === 1) break;
    }
  }
  if (lines.length < 2 && line) lines.push(line);
  return lines.slice(0, 2).map((value) => (value.length > 27 ? `${value.slice(0, 26)}…` : value));
}

/**
 * Kanonische Etikettenvorlage. Dieses SVG wird unverändert in Vorschau,
 * Druck und PNG-Export verwendet.
 */
export function labelSvgMarkup(machine: LabelMachine, format: LabelFormat, qrPng: string): string {
  const { widthMm, heightMm } = LABEL_FORMATS[format];
  const infoX =
    STANDARD_LABEL_DESIGN.paddingXmm + STANDARD_LABEL_DESIGN.qrMm + STANDARD_LABEL_DESIGN.gapMm;
  const code = escapeHtml((machine.asset_code ?? "").trim() || "OHNE NUMMER");
  const qrY = (heightMm - STANDARD_LABEL_DESIGN.qrMm) / 2;
  const lines = labelNameLines(machine);
  const nameLineMm = STANDARD_LABEL_DESIGN.namePt * PT_TO_MM * STANDARD_LABEL_DESIGN.nameLineHeight;
  const codeLineMm = STANDARD_LABEL_DESIGN.codePt * PT_TO_MM * STANDARD_LABEL_DESIGN.codeLineHeight;
  const brandLineMm = STANDARD_LABEL_DESIGN.brandPt * PT_TO_MM;
  const contentHeight =
    lines.length * nameLineMm + STANDARD_LABEL_DESIGN.infoGapMm * 2 + codeLineMm + brandLineMm;
  const contentTop = (heightMm - contentHeight) / 2;
  const nameSpans = lines
    .map(
      (line, index) =>
        `<tspan x="${infoX}" dy="${index === 0 ? 0 : nameLineMm}">${escapeHtml(line)}</tspan>`,
    )
    .join("");
  const codeY = contentTop + lines.length * nameLineMm + STANDARD_LABEL_DESIGN.infoGapMm;
  const brandY = codeY + codeLineMm + STANDARD_LABEL_DESIGN.infoGapMm;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="ah-label-svg" viewBox="0 0 ${widthMm} ${heightMm}" width="${widthMm}mm" height="${heightMm}mm" role="img" aria-label="Etikett ${code}">
    <rect width="${widthMm}" height="${heightMm}" fill="#fff"/>
    <image href="${escapeHtml(qrPng)}" x="${STANDARD_LABEL_DESIGN.paddingXmm}" y="${qrY}" width="${STANDARD_LABEL_DESIGN.qrMm}" height="${STANDARD_LABEL_DESIGN.qrMm}" preserveAspectRatio="xMidYMid meet" style="image-rendering:pixelated"/>
    <text class="ah-name" x="${infoX}" y="${contentTop}" dominant-baseline="hanging">${nameSpans}</text>
    <text class="ah-code" x="${infoX}" y="${codeY}" dominant-baseline="hanging">${code}</text>
    <text class="ah-brand" x="${infoX}" y="${brandY}" dominant-baseline="hanging">${STANDARD_LABEL_DESIGN.brandText.toUpperCase()}</text>
  </svg>`;
}

/** Reines Label-Markup (ohne Styles) — Basis für Vorschau, Einzel- und Stapeldruck. */
export function labelMarkup(machine: LabelMachine, format: LabelFormat, qrPng: string): string {
  return `<div class="ah-label ah-label--${format}">${labelSvgMarkup(machine, format, qrPng)}</div>`;
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

export function labelFileName(machine: LabelMachine, extension: "png"): string {
  const code = sanitizeFilename((machine.asset_code ?? "geraet").trim() || "geraet");
  const name = sanitizeFilename(labelName(machine));
  return `${code}_${name}_Etikett.${extension}`;
}

/**
 * Standardbasierter Browserdruck — kein Druckertreiber ist fest verdrahtet.
 * Eigenes Fenster, damit weder App-Navigation noch Dialog-Styles im Druck landen.
 */
export function printLabels(labels: string[], format: LabelFormat, mode: PrintMode): boolean {
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
<script>window.onload=async function(){var images=Array.from(document.images);await Promise.all(images.map(function(img){if(img.complete&&img.naturalWidth>0)return Promise.resolve();if(img.decode)return img.decode();return new Promise(function(resolve,reject){img.onload=resolve;img.onerror=reject;});}));window.print();};${"</script>"}
</body></html>`);
  win.document.close();
  return true;
}
