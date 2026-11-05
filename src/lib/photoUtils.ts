/** Photo helpers for field capture.
 *
 * Full-resolution capture policy: photos (live camera or attached file) are
 * kept at their capture resolution (e.g. 4K from an OTG/USB camera) as the
 * upload source, with only the small UI thumbnail compressed.
 */

const MAX_DIM = 1000; // UI preview only — uploads stay full resolution
const QUALITY = 0.62;
/** High quality for full-resolution storage: visually lossless at modest size. */
export const FULL_QUALITY = 0.92;

export async function fileToDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Could not read the photo'));
    r.readAsDataURL(file);
  });
  return dataUrl;
}

function decodeDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Could not decode the photo'));
    i.src = dataUrl;
  });
}

function drawScaled(
  source: CanvasImageSource,
  sw: number,
  sh: number,
  maxDim: number,
  quality: number,
): string {
  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the photo');
  ctx.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Downscale any video/canvas frame to a small UI preview. */
export function makeSmallPreview(
  source: CanvasImageSource,
  sw: number,
  sh: number,
): string {
  return drawScaled(source, sw, sh, MAX_DIM, QUALITY);
}

/** Legacy helper: compress an attached file for thumbnail use. */
export async function fileToCompressedDataUrl(file: File): Promise<string> {
  const img = await decodeDataUrl(await fileToDataUrl(file));
  return drawScaled(img, img.width, img.height, MAX_DIM, QUALITY);
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = /:(.*?);/.exec(meta)?.[1] ?? 'image/jpeg';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Prepare an attached photo: keep the original data URL as the full-resolution
 * source and build a small preview. Returns the original capture dimensions.
 */
export async function prepareFilePhoto(file: File): Promise<{
  full: string;
  preview: string;
  width: number;
  height: number;
}> {
  const full = await fileToDataUrl(file);
  const img = await decodeDataUrl(full);
  const preview = drawScaled(img, img.width, img.height, MAX_DIM, QUALITY);
  return { full, preview, width: img.width, height: img.height };
}
