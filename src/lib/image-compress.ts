/**
 * Browserseitige Bildaufbereitung: WebP, längste Kante max. 1600 px,
 * zusätzliches Thumbnail mit ca. 400 px. Es entstehen echte Blobs, die
 * direkt per Signed Upload URL in den Storage geladen werden — kein
 * Base64-Payload durch eine Serverfunktion.
 */
const MAX_EDGE = 1600;
const THUMB_EDGE = 400;
/** Ziel: scharfes Foto, aber typischerweise deutlich unter 1 MB. */
const TARGET_BYTES = 700_000;

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Bild konnte nicht gelesen werden."));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Bild konnte nicht verarbeitet werden."))),
      type,
      quality,
    );
  });
}

function supportsWebp() {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}

async function render(
  img: HTMLImageElement,
  maxEdge: number,
  quality: number,
  mime: string,
) {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Bild konnte nicht verarbeitet werden.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvasToBlob(canvas, mime, quality);
}

export type PreparedPhoto = {
  image: Blob;
  thumbnail: Blob;
  contentType: string;
  extension: "webp" | "jpg";
};

export async function prepareMachinePhoto(file: File): Promise<PreparedPhoto> {
  const webp = supportsWebp();
  const mime = webp ? "image/webp" : "image/jpeg";
  const img = await loadImage(file);

  let quality = 0.85;
  let image = await render(img, MAX_EDGE, quality, mime);
  while (image.size > TARGET_BYTES && quality > 0.55) {
    quality -= 0.1;
    image = await render(img, MAX_EDGE, quality, mime);
  }

  const thumbnail = await render(img, THUMB_EDGE, 0.72, mime);
  return { image, thumbnail, contentType: mime, extension: webp ? "webp" : "jpg" };
}
