import { can } from "@/lib/auth/can";
import { sameOrigin } from "@/lib/auth/request";
import { getEditor } from "@/lib/auth/server";
import { MAX_PHOTO_BYTES, writeLocalPhoto } from "@/lib/photo-store";
import { SLUG } from "@/lib/schemas";
import { storageBackend } from "@/lib/storage";

const notFound = () => new Response("Not found", { status: 404 });

/**
 * Where the editor uploads a photo under `pnpm dev` with photos on disk (public/photos): the
 * stand-in for a signed Supabase URL, so the upload works offline and in the end-to-end tests.
 * Anywhere else it doesn't exist. Like the bucket, it takes webp only and never replaces a file.
 */
export async function PUT(req: Request, ctx: RouteContext<"/api/editor/[slug]/photos/local/[name]">) {
  const { slug, name } = await ctx.params;
  if (process.env.NODE_ENV !== "development" || storageBackend() !== "local") return notFound();
  if (!SLUG.test(slug) || !/^\d+-[a-z0-9-]+\.(full|thumb)\.webp$/.test(name)) return notFound();
  if (!can(await getEditor(), "photos", slug)) return notFound();
  if (!sameOrigin(req)) return new Response("Request must come from the editor.", { status: 403 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_PHOTO_BYTES) return new Response("Too large.", { status: 413 });

  const bytes = new Uint8Array(await req.arrayBuffer());
  const tag = (from: number) => String.fromCharCode(...bytes.subarray(from, from + 4));
  if (bytes.length > MAX_PHOTO_BYTES || tag(0) !== "RIFF" || tag(8) !== "WEBP") return new Response("Not a webp image.", { status: 400 });
  try {
    await writeLocalPhoto(slug, name, bytes);
  } catch {
    return new Response("That photo already exists.", { status: 409 });
  }
  return Response.json({ ok: true });
}

export { notFound as GET, notFound as POST, notFound as DELETE, notFound as PATCH };
