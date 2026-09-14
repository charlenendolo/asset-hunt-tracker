import {
  LABEL_FORMATS,
  LABEL_CSS,
  labelSvgMarkup,
  type LabelFormat,
  type LabelMachine,
} from "@/lib/qr-labels";

const EXPORT_DPI = 300;
const MM_PER_INCH = 25.4;

const mmToPx = (mm: number, dpi = EXPORT_DPI) => (mm / MM_PER_INCH) * dpi;

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

/**
 * Verlustfreie 300-DPI-Rasterung exakt derselben SVG-Vorlage, die Vorschau
 * und Druck verwenden. Es gibt kein separates PNG-Layout.
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

  const svg = labelSvgMarkup(machine, format, qrPng).replace(
    "</svg>",
    `<style>${LABEL_CSS}</style></svg>`,
  );
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const labelImage = await loadImage(svgUrl);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(labelImage, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }

  return canvasToPng(canvas);
}