import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { can } from "@/lib/auth/can";
import { rateLimiter, sameOrigin } from "@/lib/auth/request";
import { getEditor } from "@/lib/auth/server";
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
 * Only then is anything written, with who and when, and the public pages are refreshed.
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

  if (result.ok) {
    // The guide's page and the gallery are cached; a save makes the next visit render them fresh.
    revalidatePath(`/hikes/${slug}`);
    revalidatePath("/");
    // From a route, revalidatePath only marks the pages: the next visitor is still handed the old
    // copy while a fresh one is made. After Publish or Unpublish that visitor is us, so nobody
    // else is served a guide that was just taken down (or misses one that just went up).
    if (result.previousStatus !== result.status) {
      after(() => Promise.allSettled([`/hikes/${slug}`, "/"].map((p) => fetch(new URL(p, req.url), { cache: "no-store" }))));
    }
    return json({ ok: true, version: result.version, status: result.status, savedAt: new Date().toISOString() }, 200);
  }
  if (result.kind === "invalid") return json({ ok: false, problems: result.problems }, 422);
  if (result.kind === "conflict") return json({ ok: false, conflict: true, version: result.version }, 409);
  return notFound();
}

/**
 * Deletes a draft. The same checks as a save; the store then refuses a guide that is published
 * (unpublish it first) or that changed since the editor last saw it.
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
  const result = await store.deleteDraft(slug, { editor, baseVersion: body.baseVersion });
  if (result.ok) {
    // Drafts have no public page, but under `pnpm dev` the gallery lists them.
    revalidatePath("/");
    return json({ ok: true }, 200);
  }
  if (result.kind === "published") return json({ ok: false, problems: ["Only a draft can be deleted. Unpublish it first."] }, 409);
  if (result.kind === "conflict") return json({ ok: false, conflict: true, version: result.version }, 409);
  return notFound();
}

// Other methods get the same 404 as everything else about the editor (Next would say 405).
export { notFound as GET, notFound as POST, notFound as PATCH };
