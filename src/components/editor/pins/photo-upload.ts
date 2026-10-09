import type { Photo } from "@/lib/schemas";
import { photoUrl } from "@/lib/storage";

/** The editor's side of the photo routes (src/app/api/editor/[slug]/photos). */
export type Upload = { url: string; headers: Record<string, string> };
export type Grant = { key: string; full: Upload; thumb: Upload };

const problem = async (res: Response) => {
  const body = (await res.json().catch(() => null)) as { problems?: string[] } | null;
  return new Error(body?.problems?.join(" ") ?? `The server answered ${res.status}.`);
};

const send = (slug: string, method: string, body?: unknown) =>
  fetch(`/api/editor/${slug}/photos`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });

/** Keys of every photo stored for the hike. */
export async function listPhotos(slug: string): Promise<string[]> {
  const res = await send(slug, "GET");
  if (!res.ok) throw await problem(res);
  return ((await res.json()) as { keys: string[] }).keys;
}

/** Asks where to upload these photos. The server names them; the order is kept. */
export async function requestUploads(slug: string, files: { name: string; fullBytes: number; thumbBytes: number }[]): Promise<Grant[]> {
  const res = await send(slug, "POST", { files });
  if (!res.ok) throw await problem(res);
  return ((await res.json()) as { photos: Grant[] }).photos;
}

export async function deletePhoto(slug: string, key: string): Promise<void> {
  const res = await send(slug, "DELETE", { key });
  if (!res.ok) throw await problem(res);
}

/** Uploads one file. XMLHttpRequest rather than fetch, because it reports progress. */
export function putBlob({ url, headers }: Upload, blob: Blob, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`The upload was refused (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("The upload didn't get through. Check the connection and try again."));
    xhr.send(blob);
  });
}

/** A stored photo's entry for a pin, measured from the image itself (for photos uploaded in an earlier visit). */
export function measurePhoto(key: string): Promise<Photo> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ key, kind: Math.abs(img.naturalWidth / img.naturalHeight - 2) < 0.02 ? "pano" : "flat", width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("That photo's file couldn't be loaded."));
    img.src = photoUrl(key, "full");
  });
}
