import {
  LABEL_FORMATS,
  STANDARD_LABEL_DESIGN,
  labelName,
  type LabelFormat,
  type LabelMachine,
} from "@/lib/qr-labels";

const EXPORT_DPI = 300;
const MM_PER_INCH = 25.4;
const PT_PER_INCH = 72;

const mmToPx = (mm: number, dpi = EXPORT_DPI) => (mm / MM_PER_INCH) * dpi;
const ptToPx = (pt: number, dpi = EXPORT_DPI) => (pt / PT_PER_INCH) * dpi;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
    image.src = src;
  });
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Etikett konnte nicht als PNG erzeugt werden."));
    }, "image/png");
  });
}

function fitLine(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let text = value;
  while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
  return `${text.trimEnd()}…`;
}

function wrapName(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    lines.push(fitLine(ctx, line, maxWidth));
    line = word;
    if (lines.length === 1) break;
  }
  if (lines.length < 2 && line) lines.push(fitLine(ctx, line, maxWidth));
  return lines.slice(0, 2);
}

/**
 * Verlustfreies, druckfertiges Abbild der kanonischen HTML-Druckvorlage.
 * Alle Maße und Schriftwerte stammen aus STANDARD_LABEL_DESIGN.
 */
export async function renderLabelPng(
  machine: LabelMachine,
  format: LabelFormat,
  qrPng: string,
): Promise<Blob> {
  const { widthMm, heightMm } = LABEL_FORMATS[format];
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(mmToPx(widthMm));
  canvas.height = Math.round(mmToPx(heightMm));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Bildausgabe wird von diesem Browser nicht unterstützt.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const qrImage = await loadImage(qrPng);
  const qrPx = Math.round(mmToPx(STANDARD_LABEL_DESIGN.qrMm));
  const qrX = Math.round(mmToPx(STANDARD_LABEL_DESIGN.paddingXmm));
  const qrY = Math.round((canvas.height - qrPx) / 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qrImage, qrX, qrY, qrPx, qrPx);

  const infoX = qrX + qrPx + mmToPx(STANDARD_LABEL_DESIGN.gapMm);
  const infoWidth = canvas.width - infoX - mmToPx(STANDARD_LABEL_DESIGN.paddingXmm);
  const nameSize = ptToPx(STANDARD_LABEL_DESIGN.namePt);
  const codeSize = ptToPx(STANDARD_LABEL_DESIGN.codePt);
  const brandSize = ptToPx(STANDARD_LABEL_DESIGN.brandPt);
  const nameLineHeight = nameSize * STANDARD_LABEL_DESIGN.nameLineHeight;
  const gap = mmToPx(STANDARD_LABEL_DESIGN.infoGapMm);

  ctx.textBaseline = "top";
  ctx.fillStyle = "#000000";
  ctx.font = `${STANDARD_LABEL_DESIGN.nameWeight} ${nameSize}px Inter, Arial, Helvetica, sans-serif`;
  const nameLines = wrapName(ctx, labelName(machine), infoWidth);
  const nameHeight = nameLines.length * nameLineHeight;
  const codeHeight = codeSize * STANDARD_LABEL_DESIGN.codeLineHeight;
  const brandHeight = brandSize;
  const contentHeight = nameHeight + gap + codeHeight + gap + brandHeight;
  let y = (canvas.height - contentHeight) / 2;

  for (const line of nameLines) {
    ctx.fillText(line, infoX, y);
    y += nameLineHeight;
  }

  y += gap;
  ctx.font = `${STANDARD_LABEL_DESIGN.codeWeight} ${codeSize}px Inter, Arial, Helvetica, sans-serif`;
  ctx.fillText(fitLine(ctx, (machine.asset_code ?? "").trim() || "OHNE NUMMER", infoWidth), infoX, y);

  y += codeHeight + gap;
  ctx.fillStyle = STANDARD_LABEL_DESIGN.brandColor;
  ctx.font = `${STANDARD_LABEL_DESIGN.brandWeight} ${brandSize}px Inter, Arial, Helvetica, sans-serif`;
  ctx.letterSpacing = `${STANDARD_LABEL_DESIGN.brandLetterSpacingEm}em`;
  ctx.fillText(STANDARD_LABEL_DESIGN.brandText.toUpperCase(), infoX, y);

  return canvasToPng(canvas);
}