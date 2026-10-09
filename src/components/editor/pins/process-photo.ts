import { EXIF_OPTIONS, readPhotoMeta, variantSize, WEBP_QUALITY, type ScannedPhoto } from "@/lib/ingest";
import type { PhotoVariant } from "@/lib/storage";

/**
 * A photo made ready for upload, in the browser: the same two webp variants `pnpm ingest` writes
 * with sharp. Drawing to a canvas and encoding again leaves every bit of metadata behind (GPS,
 * time, camera), so only the pixels leave the device; position and heading travel separately, as
 * the pin, and the capture time stays in this tab's memory to order the batch.
 */
export type ProcessedPhoto = {
  /** What ingest read from the file. `width` and `height` are the original's, upright. */
  meta: ScannedPhoto;
  full: Blob;
  thumb: Blob;
  /** Size of the stored full variant, for the pin's `photo`. */
  width: number;
  height: number;
};

/** A photo that can't be processed, with a message written for the person who dropped it. */
export class PhotoError extends Error {}

/**
 * iOS Safari gives a blank canvas, with no error, above 16.7 million pixels. Only a 360° photo's
 * full variant is larger (6144 × 3072), so it's stored a little smaller from a browser than from
 * `pnpm ingest`: 5792 × 2896.
 */
export const MAX_CANVAS_PIXELS = 16_777_216;

export function fitCanvas(size: { width: number; height: number }): { width: number; height: number } {
  const scale = Math.min(1, Math.sqrt(MAX_CANVAS_PIXELS / (size.width * size.height)));
  return { width: Math.floor(size.width * scale), height: Math.floor(size.height * scale) };
}

type Canvas = OffscreenCanvas | HTMLCanvasElement;
type Context = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function makeCanvas(width: number, height: number): { canvas: Canvas; ctx: Context } {
  const canvas: Canvas = typeof OffscreenCanvas === "undefined" ? Object.assign(document.createElement("canvas"), { width, height }) : new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d") as Context | null;
  if (!ctx) throw new PhotoError("This browser couldn't resize the photo.");
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}

/**
 * Draws `source` at the target size. A canvas samples only a few source pixels per output pixel,
 * so shrinking 4000 px to 480 in one go looks jagged; halving until the last step doesn't.
 */
function resize(source: ImageBitmap | Canvas, target: { width: number; height: number }): { canvas: Canvas; ctx: Context } {
  let from: ImageBitmap | Canvas = source;
  while (from.width > target.width * 2) {
    const half = makeCanvas(Math.ceil(from.width / 2), Math.ceil(from.height / 2));
    half.ctx.drawImage(from, 0, 0, half.canvas.width, half.canvas.height);
    from = half.canvas;
  }
  const out = makeCanvas(target.width, target.height);
  out.ctx.drawImage(from, 0, 0, target.width, target.height);
  return out;
}

async function toWebp({ canvas, ctx }: { canvas: Canvas; ctx: Context }, variant: PhotoVariant): Promise<Blob> {
  const quality = WEBP_QUALITY[variant];
  const blob =
    "convertToBlob" in canvas
      ? await canvas.convertToBlob({ type: "image/webp", quality: quality / 100 })
      : await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/webp", quality / 100));
  // A browser that can't encode webp (Safari) answers with a PNG instead of failing.
  if (blob?.type === "image/webp") return blob;
  const { encode } = await import("@jsquash/webp");
  return new Blob([await encode(ctx.getImageData(0, 0, canvas.width, canvas.height), { quality })], { type: "image/webp" });
}

export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  const { default: exifr } = await import("exifr");
  // No EXIF at all is fine: the photo just has no position.
  const exif = await exifr.parse(file, EXIF_OPTIONS).catch(() => null);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const heic = /\.hei[cf]$/i.test(file.name) || /hei[cf]/.test(file.type);
    throw new PhotoError(heic ? "This browser can't read HEIC photos. Export it as a JPEG, or use Safari." : "This file isn't a photo the browser can read.");
  }

  try {
    const size = { width: bitmap.width, height: bitmap.height };
    const meta = readPhotoMeta(exif, size);
    const full = resize(bitmap, fitCanvas(variantSize(size, meta.isPano, "full")));
    // The thumbnail is made from the full variant: fewer pixels to halve.
    const thumb = resize(full.canvas, variantSize(size, meta.isPano, "thumb"));
    return {
      meta: { ...meta, name: file.name, ...size },
      full: await toWebp(full, "full"),
      thumb: await toWebp(thumb, "thumb"),
      width: full.canvas.width,
      height: full.canvas.height,
    };
  } finally {
    bitmap.close();
  }
}
