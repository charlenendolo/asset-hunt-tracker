/**
 * Browserseitige Bildaufbereitung: WebP, längste Kante max. 1600 px,
 * zusätzliches Thumbnail mit ca. 400 px. So bleiben Uploads klein und
 * die Server-Funktion muss keine Bildverarbeitung im Worker ausführen.
 */
const MAX_EDGE = 1600;
const THUMB_EDGE = 400;

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

function render(img: HTMLImageElement, maxEdge: number, quality: number) {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Bild konnte nicht verarbeitet werden.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/webp", quality);
}

export async function prepareMachinePhoto(file: File) {
  const img = await loadImage(file);
  let quality = 0.82;
  let image = render(img, MAX_EDGE, quality);
  // Ziel: unter ~400 KB Nutzlast.
  while (image.length > 540_000 && quality > 0.45) {
    quality -= 0.12;
    image = render(img, MAX_EDGE, quality);
  }
  const thumbnail = render(img, THUMB_EDGE, 0.7);
  return { image, thumbnail };
}
