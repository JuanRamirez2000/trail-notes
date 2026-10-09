import { can } from "@/lib/auth/can";
import { rateLimiter, sameOrigin } from "@/lib/auth/request";
import { getEditor } from "@/lib/auth/server";
import { existingNumbering, kebab, photoKey } from "@/lib/ingest";
import { getPhotoStore, MAX_PHOTO_BYTES, PhotoStoreUnavailable, photosBelongToStore } from "@/lib/photo-store";
import { SLUG, waypointsFileSchema } from "@/lib/schemas";
import { mentionsPhoto, photoObjectPath, type PhotoVariant } from "@/lib/storage";
import { getStore } from "@/lib/store/server";

/** Photos per request. The editor sends a drop in batches of this size. */
const MAX_FILES = 30;
const allow = rateLimiter({ limit: 60, windowMs: 60_000 });
const VARIANTS: PhotoVariant[] = ["full", "thumb"];

const notFound = () => new Response("Not found", { status: 404 });
const json = (body: unknown, status: number) => Response.json(body, { status });
const unavailable = (err: unknown) => {
  if (err instanceof PhotoStoreUnavailable) return json({ ok: false, problems: [err.message] }, 503);
  throw err;
};

/** The same first checks as a save: an editor allowed on this hike (anyone else gets a 404), from our own pages, not too often. */
async function guard(req: Request, slug: string, { write }: { write: boolean }) {
  if (!SLUG.test(slug)) return notFound();
  const editor = await getEditor();
  if (!can(editor, "photos", slug)) return notFound();
  if (write && !sameOrigin(req)) return json({ ok: false, problems: ["Request must come from the editor."] }, 403);
  if (!allow(editor.id)) return json({ ok: false, problems: ["Too many requests. Wait a moment and try again."] }, 429);
  return null;
}

async function body<T>(req: Request): Promise<T | null> {
  try {
    return JSON.parse((await req.text()).slice(0, 20_000)) as T;
  } catch {
    return null;
  }
}

/** The number in `07-img-3101.full.webp`. */
const fileNumber = (name: string) => Number(/^(\d+)-/.exec(name)?.[1] ?? 0);

/** The photos stored for this hike, as keys (`<slug>/<NN>-<name>`), whether or not a pin uses them. */
export async function GET(req: Request, ctx: RouteContext<"/api/editor/[slug]/photos">) {
  const { slug } = await ctx.params;
  const refused = await guard(req, slug, { write: false });
  if (refused) return refused;
  if (!(await (await getStore()).read(slug))) return notFound();
  try {
    const names = await (await getPhotoStore()).list(slug);
    const suffix = ".full.webp";
    return json({ ok: true, keys: names.filter((n) => n.endsWith(suffix)).map((n) => `${slug}/${n.slice(0, -suffix.length)}`).sort() }, 200);
  } catch (err) {
    return unavailable(err);
  }
}

/**
 * Says where the browser may upload new photos. The caller sends file names and sizes only; the
 * storage paths are made here, numbered after everything the folder and the pins already hold, so
 * a request can't name a path, and a new photo can't land on an old one (uploads never replace).
 * What's uploaded is checked by the bucket itself, which takes webp up to 20 MB and nothing else.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/editor/[slug]/photos">) {
  const { slug } = await ctx.params;
  const refused = await guard(req, slug, { write: true });
  if (refused) return refused;

  const files = (await body<{ files?: unknown }>(req))?.files;
  const size = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n > 0 && n <= MAX_PHOTO_BYTES;
  const valid =
    Array.isArray(files) &&
    files.length > 0 &&
    files.length <= MAX_FILES &&
    files.every((f) => typeof f?.name === "string" && f.name.length <= 200 && kebab(f.name) !== "" && size(f.fullBytes) && size(f.thumbBytes));
  if (!valid) return json({ ok: false, problems: [`Expected { files: [{ name, fullBytes, thumbBytes }] }: 1 to ${MAX_FILES} photos of at most 20 MB each.`] }, 400);

  const record = await (await getStore()).read(slug);
  if (!record) return notFound();
  const pins = waypointsFileSchema.safeParse(JSON.parse(record.waypoints));
  if (!pins.success) return json({ ok: false, problems: ["This hike's pins are invalid. Fix them under Advanced first."] }, 422);

  try {
    const photos = await getPhotoStore();
    const next = Math.max(existingNumbering(pins.data.waypoints).next, ...(await photos.list(slug)).map((n) => fileNumber(n) + 1));
    const keys = (files as { name: string }[]).map((f, i) => photoKey(slug, next + i, f.name));
    const urls = await photos.signUploads(keys.flatMap((key) => VARIANTS.map((v) => photoObjectPath(key, v))));
    return json({ ok: true, photos: keys.map((key, i) => ({ key, full: urls[i * 2], thumb: urls[i * 2 + 1] })) }, 200);
  } catch (err) {
    return unavailable(err);
  }
}

/**
 * Deletes a photo's files. Refused while anything still shows it: a pin or the cover, in the
 * working copy or the published one. Older versions in History aren't checked: restoring one can
 * bring back a pin whose photo is gone, and the pin then shows as having no photo to pick.
 */
export async function DELETE(req: Request, ctx: RouteContext<"/api/editor/[slug]/photos">) {
  const { slug } = await ctx.params;
  const refused = await guard(req, slug, { write: true });
  if (refused) return refused;

  const key = (await body<{ key?: unknown }>(req))?.key;
  if (typeof key !== "string" || !key.startsWith(`${slug}/`) || !/^[a-z0-9-]+\/[a-z0-9._-]+$/.test(key)) return json({ ok: false, problems: ["Expected { key } naming one of this hike's photos."] }, 400);

  const store = await getStore();
  const record = await store.read(slug);
  if (!record) return notFound();
  const used = [record.mdx, record.waypoints, record.published?.mdx ?? "", record.published?.waypoints ?? ""].some((text) => mentionsPhoto(text, key));
  if (used) return json({ ok: false, problems: [`That photo is still used by a pin or as the cover in the saved guide${record.published ? " or on the published page" : ""}. If you just took it off, try again once that's saved.`] }, 409);

  try {
    const photos = await getPhotoStore();
    if (!photosBelongToStore(store.kind, photos.kind)) return json({ ok: false, problems: ["This server edits guides in files but shows photos from shared storage, where the live site may still use them. Delete photos in the live editor."] }, 409);
    await photos.remove(VARIANTS.map((v) => photoObjectPath(key, v)));
    return json({ ok: true }, 200);
  } catch (err) {
    return unavailable(err);
  }
}

export { notFound as PUT, notFound as PATCH };
