import { can } from "@/lib/auth/can";
import { rateLimiter, sameOrigin } from "@/lib/auth/request";
import { getEditor } from "@/lib/auth/server";
import { refreshPublic } from "@/lib/refresh-public";
import { SLUG } from "@/lib/schemas";
import { getStore } from "@/lib/store/server";
import { MAX_MDX_BYTES, MAX_WAYPOINTS_BYTES } from "@/lib/store/validate";

/** Room for both texts plus JSON overhead; anything larger is refused before it's read. */
const MAX_BODY_BYTES = MAX_MDX_BYTES + MAX_WAYPOINTS_BYTES + 10_000;
/** Autosave fires at most every 1.5 s while typing; this leaves headroom and stops a runaway client. */
const allow = rateLimiter({ limit: 60, windowMs: 60_000 });

const notFound = () => new Response("Not found", { status: 404 });
const json = (body: unknown, status: number) => Response.json(body, { status });

/**
 * Saves a guide. The order of the checks is the point:
 *   1. the caller is a signed-in editor allowed to save this hike; anyone else gets a plain 404
 *   2. the request comes from our own pages (not another site driving an editor's browser)
 *   3. size and rate limits
 *   4. the store validates (schemas + MDX compile + no code) and refuses a stale version
 * Only then is anything written, with who and when. The public site doesn't change: it shows the
 * published copy until the guide is published again.
 */
export async function PUT(req: Request, ctx: RouteContext<"/api/editor/[slug]">) {
  const { slug } = await ctx.params;
  if (!SLUG.test(slug)) return notFound();

  const editor = await getEditor();
  if (!can(editor, "save", slug)) return notFound();
  if (!sameOrigin(req)) return json({ ok: false, problems: ["Request must come from the editor."] }, 403);

  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json({ ok: false, problems: ["That's too large to save."] }, 413);
  if (!allow(editor.id)) return json({ ok: false, problems: ["Saving too often. Wait a moment and try again."] }, 429);

  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) return json({ ok: false, problems: ["That's too large to save."] }, 413);
  let body: { mdx?: unknown; waypoints?: unknown; baseVersion?: unknown } | null = null;
  try {
    body = JSON.parse(text);
  } catch {
    // handled below
  }
  if (typeof body?.mdx !== "string" || typeof body?.waypoints !== "string" || typeof body?.baseVersion !== "string") {
    return json({ ok: false, problems: ["Expected { mdx, waypoints, baseVersion } as strings."] }, 400);
  }

  const store = await getStore();
  const result = await store.save(slug, { mdx: body.mdx, waypoints: body.waypoints }, { editor, baseVersion: body.baseVersion });

  // A save changes the working copy only; the public pages change on publish (./publish/route.ts).
  if (result.ok) {
    return json({ ok: true, version: result.version, status: result.status, savedAt: new Date().toISOString() }, 200);
  }
  if (result.kind === "invalid") return json({ ok: false, problems: result.problems }, 422);
  if (result.kind === "conflict") return json({ ok: false, conflict: true, version: result.version }, 409);
  return notFound();
}

/**
 * Deletes a hike, in two stages. Now: its public page comes down and it's marked for deletion.
 * After DELETE_DELAY_HOURS: it's removed for good, with its history and photos (src/lib/purge.ts).
 * In between it can be restored (./restore/route.ts). The same checks as a save; the store
 * refuses a hike that changed since the editor last saw it.
 */
export async function DELETE(req: Request, ctx: RouteContext<"/api/editor/[slug]">) {
  const { slug } = await ctx.params;
  if (!SLUG.test(slug)) return notFound();

  const editor = await getEditor();
  if (!can(editor, "delete", slug)) return notFound();
  if (!sameOrigin(req)) return json({ ok: false, problems: ["Request must come from the editor."] }, 403);
  if (!allow(editor.id)) return json({ ok: false, problems: ["Too many requests. Wait a moment and try again."] }, 429);

  let body: { baseVersion?: unknown } | null = null;
  try {
    body = JSON.parse((await req.text()).slice(0, 1000));
  } catch {
    // handled below
  }
  if (typeof body?.baseVersion !== "string") return json({ ok: false, problems: ["Expected { baseVersion } as a string."] }, 400);

  const store = await getStore();
  const result = await store.scheduleDelete(slug, { editor, baseVersion: body.baseVersion });
  if (result.ok) {
    // It may have been published a moment ago: its page, and every page that lists it, goes now.
    refreshPublic(slug, req);
    return json({ ok: true, deleteAfter: result.deleteAfter }, 200);
  }
  if (result.kind === "conflict") return json({ ok: false, conflict: true, version: result.version }, 409);
  return notFound();
}

// Other methods get the same 404 as everything else about the editor (Next would say 405).
export { notFound as GET, notFound as POST, notFound as PATCH };
