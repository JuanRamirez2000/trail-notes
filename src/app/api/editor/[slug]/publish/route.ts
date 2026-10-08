import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { can } from "@/lib/auth/can";
import { rateLimiter, sameOrigin } from "@/lib/auth/request";
import { getEditor } from "@/lib/auth/server";
import { SLUG } from "@/lib/schemas";
import { getStore } from "@/lib/store/server";

const allow = rateLimiter({ limit: 30, windowMs: 60_000 });
const notFound = () => new Response("Not found", { status: 404 });
const json = (body: unknown, status: number) => Response.json(body, { status });

/**
 * POST publishes the guide's working copy (at `baseVersion`); DELETE unpublishes it. The same
 * guards as a save, then the store (which validates before publishing and refuses a stale
 * version), then the public pages are refreshed.
 */
async function change(req: Request, ctx: RouteContext<"/api/editor/[slug]/publish">, action: "publish" | "unpublish") {
  const { slug } = await ctx.params;
  if (!SLUG.test(slug)) return notFound();

  const editor = await getEditor();
  if (!can(editor, "publish", slug)) return notFound();
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
  const result = await store[action](slug, { editor, baseVersion: body.baseVersion });
  if (result.ok) {
    revalidatePath(`/hikes/${slug}`);
    revalidatePath("/");
    // From a route, revalidatePath only marks the pages: the next visitor is still handed the old
    // copy while a fresh one is made. That visitor is us, so nobody else is served a guide that was
    // just taken down, or the version from before it was published.
    after(() => Promise.allSettled([`/hikes/${slug}`, "/"].map((p) => fetch(new URL(p, req.url), { cache: "no-store" }))));
    return json({ ok: true, status: result.status, at: new Date().toISOString() }, 200);
  }
  if (result.kind === "invalid") return json({ ok: false, problems: result.problems }, 422);
  if (result.kind === "conflict") return json({ ok: false, conflict: true, version: result.version }, 409);
  return notFound();
}

export const POST = (req: Request, ctx: RouteContext<"/api/editor/[slug]/publish">) => change(req, ctx, "publish");
export const DELETE = (req: Request, ctx: RouteContext<"/api/editor/[slug]/publish">) => change(req, ctx, "unpublish");

// Other methods get the same 404 as everything else about the editor (Next would say 405).
export { notFound as GET, notFound as PUT, notFound as PATCH };
