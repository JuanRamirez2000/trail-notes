/**
 * Resolves photo storage keys (`<slug>/<name>`) to URLs.
 *
 * The ingest script writes two webp variants per photo:
 *   <key>.full.webp  (2400px long edge, 6144px for panos)
 *   <key>.thumb.webp (480px long edge)
 *
 * Backend is picked with NEXT_PUBLIC_PHOTO_STORAGE:
 *   local    → /public/photos (default; handy offline and for the sample hike)
 *   supabase → public bucket on NEXT_PUBLIC_SUPABASE_URL
 */

export type PhotoVariant = "full" | "thumb";
export type StorageBackend = "local" | "supabase";

export const PHOTO_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? "hikes";

export function storageBackend(): StorageBackend {
  return process.env.NEXT_PUBLIC_PHOTO_STORAGE === "supabase" ? "supabase" : "local";
}

export function photoObjectPath(key: string, variant: PhotoVariant) {
  return `${key}.${variant}.webp`;
}

export function photoUrl(key: string, variant: PhotoVariant = "full"): string {
  const path = photoObjectPath(key, variant);
  if (storageBackend() === "supabase") {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required when NEXT_PUBLIC_PHOTO_STORAGE=supabase");
    return `${base}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
  }
  return `/photos/${path}`;
}
