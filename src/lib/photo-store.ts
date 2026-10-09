import "server-only";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PHOTO_BUCKET, storageBackend } from "./storage";

/**
 * Photo files, as the editor's server routes see them: what a hike's folder holds, where the
 * browser may upload to, and deleting. Reading a photo needs none of this (lib/storage.ts builds
 * public URLs).
 *
 * The backend follows NEXT_PUBLIC_PHOTO_STORAGE, like the URLs:
 *   supabase → the bucket, with the service-role key. The browser uploads straight to Supabase
 *              through signed URLs, so photo bytes never pass through this server.
 *   local    → public/photos, `pnpm dev` only (the end-to-end tests run on it).
 */
export type Upload = { url: string; headers: Record<string, string> };

export interface PhotoStore {
  readonly kind: "supabase" | "local";
  /** File names in a hike's folder, e.g. `01-img-3101.full.webp`. */
  list(slug: string): Promise<string[]>;
  /** Where to PUT each object (`<slug>/<file>`), in the same order. An existing object is never replaced. */
  signUploads(objects: string[]): Promise<Upload[]>;
  remove(objects: string[]): Promise<void>;
  removeFolder(slug: string): Promise<void>;
}

/** The store can't be used as configured (a missing key). The message is safe to show an editor. */
export class PhotoStoreUnavailable extends Error {}

/** The largest file the bucket accepts. */
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const UPLOAD_HEADERS = { "content-type": "image/webp", "cache-control": "max-age=31536000" };

export const LOCAL_PHOTOS = path.join(process.cwd(), "public/photos");

function localStore(): PhotoStore {
  if (process.env.NODE_ENV !== "development") throw new PhotoStoreUnavailable("Photos on this server's disk are for pnpm dev only.");
  return {
    kind: "local",
    list: async (slug) => (await readdir(path.join(LOCAL_PHOTOS, slug)).catch(() => [])).filter((f) => f.endsWith(".webp")),
    // Handled by ./photos/local/[name]/route.ts, which is a 404 on any other backend.
    signUploads: async (objects) =>
      objects.map((o) => {
        const [slug, name] = o.split("/");
        return { url: `/api/editor/${slug}/photos/local/${name}`, headers: UPLOAD_HEADERS };
      }),
    remove: async (objects) => void (await Promise.all(objects.map((o) => rm(path.join(LOCAL_PHOTOS, o), { force: true })))),
    removeFolder: (slug) => rm(path.join(LOCAL_PHOTOS, slug), { recursive: true, force: true }),
  };
}

/** Writes one uploaded file under `pnpm dev`. Fails if it's already there. */
export async function writeLocalPhoto(slug: string, name: string, body: Uint8Array) {
  await mkdir(path.join(LOCAL_PHOTOS, slug), { recursive: true });
  await writeFile(path.join(LOCAL_PHOTOS, slug, name), body, { flag: "wx" });
}

async function supabaseStore(): Promise<PhotoStore> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new PhotoStoreUnavailable("Photo uploads aren't set up on this server: it has no SUPABASE_SERVICE_ROLE_KEY.");
  const { createClient } = await import("@supabase/supabase-js");
  const bucket = createClient(url, key, { auth: { persistSession: false } }).storage.from(PHOTO_BUCKET);
  // Not needed to use a signed URL, but harmless, and it's what Supabase's own client sends.
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const headers = { ...UPLOAD_HEADERS, "x-upsert": "false", ...(publicKey ? { apikey: publicKey } : {}) };

  const list = async (slug: string) => {
    const { data, error } = await bucket.list(slug, { limit: 1000 });
    if (error) throw new Error(`Listing photos of "${slug}": ${error.message}`);
    return data.filter((f) => f.id).map((f) => f.name);
  };
  const remove = async (objects: string[]) => {
    if (!objects.length) return;
    const { error } = await bucket.remove(objects);
    if (error) throw new Error(`Deleting photos: ${error.message}`);
  };
  return {
    kind: "supabase",
    list,
    signUploads: (objects) =>
      Promise.all(
        objects.map(async (o) => {
          const { data, error } = await bucket.createSignedUploadUrl(o);
          if (error) throw new Error(`${o}: ${error.message}`);
          return { url: data.signedUrl, headers };
        }),
      ),
    remove,
    removeFolder: async (slug) => remove((await list(slug)).map((name) => `${slug}/${name}`)),
  };
}

export async function getPhotoStore(): Promise<PhotoStore> {
  return storageBackend() === "supabase" ? supabaseStore() : localStore();
}

/**
 * Whether the guides this server edits are the only ones using the photo storage it writes to.
 * `pnpm dev` usually reads guides from files while showing photos from the live bucket; a photo
 * that no guide in content/ uses may still be on the live site, so nothing is deleted then.
 */
export const photosBelongToStore = (store: "local" | "postgres", photos: PhotoStore["kind"]) => (store === "postgres") === (photos === "supabase");
