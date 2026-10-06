import { revalidatePath } from "next/cache";
import { can } from "@/lib/auth/can";
import { rateLimiter, sameOrigin } from "@/lib/auth/request";
import { getEditor } from "@/lib/auth/server";
import { getStore } from "@/lib/store/server";
import { MAX_MDX_BYTES, MAX_WAYPOINTS_BYTES, SLUG } from "@/lib/store/validate";

/** A recorded track is the big part of a new hike: a long day out simplifies to a few hundred points. */
const MAX_TRACK_BYTES = 1_000_000;
const MAX_BODY_BYTES = MAX_MDX_BYTES + MAX_WAYPOINTS_BYTES + MAX_TRACK_BYTES + 10_000;
/** Creating hikes is rare; this only stops a runaway client. */
const allow = rateLimiter({ limit: 10, windowMs: 60_000 });

const json = (body: unknown, status: number) => Response.json(body, { status });

/**
 * Creates a hike. Same order of checks as saving one (see [slug]/route.ts): a signed-in editor
 * allowed to create (a plain 404 for anyone else), from our own pages, within size and rate
 * limits; then the store validates everything (details, pins, MDX, track) before it writes.
 */
export async function POST(req: Request) {
  const editor = await getEditor();
  if (!can(editor, "create")) return new Response("Not found", { status: 404 });
  if (!sameOrigin(req)) return json({ ok: false, problems: ["Request must come from the editor."] }, 403);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json({ ok: false, problems: ["That's too large to save."] }, 413);
  if (!allow(editor.id)) return json({ ok: false, problems: ["Creating too often. Wait a moment and try again."] }, 429);

  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) return json({ ok: false, problems: ["That's too large to save."] }, 413);
  let body: { slug?: unknown; mdx?: unknown; waypoints?: unknown; track?: unknown } | null = null;
  try {
    body = JSON.parse(text);
  } catch {
    // handled below
  }
  if (typeof body?.slug !== "string" || !SLUG.test(body.slug) || typeof body.mdx !== "string" || typeof body.waypoints !== "string") {
    return json({ ok: false, problems: ["Expected { slug, mdx, waypoints } as strings, with a lowercase-and-dashes slug."] }, 400);
  }
  // `/editor/new` is this form's own page, so a hike can't have that address.
  if (body.slug === "new") return json({ ok: false, problems: ['"new" can\'t be used as an address.'] }, 400);
  if (body.track != null && Buffer.byteLength(JSON.stringify(body.track)) > MAX_TRACK_BYTES) {
    return json({ ok: false, problems: ["That recording is too large. Export a shorter or lower-resolution GPX."] }, 413);
  }

  const store = await getStore();
  // The store checks the track's shape; anything that isn't a valid track is refused there.
  const result = await store.create(body.slug, { mdx: body.mdx, waypoints: body.waypoints, track: (body.track ?? null) as never }, { editor });

  if (result.ok) {
    revalidatePath("/");
    return json({ ok: true, slug: body.slug, version: result.version }, 201);
  }
  if (result.kind === "invalid") return json({ ok: false, problems: result.problems }, 422);
  if (result.kind === "exists") return json({ ok: false, problems: [`There's already a hike at "${body.slug}". Choose a different address.`] }, 409);
  return json({ ok: false, problems: ["Couldn't create the hike."] }, 500);
}
