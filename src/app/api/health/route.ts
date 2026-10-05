import { contentStoreKind, getStore } from "@/lib/store/server";

// Always answered live: the point is to touch the store.
export const dynamic = "force-dynamic";

/**
 * A daily scheduled request (vercel.json) hits this. With guides in Supabase it reads from the
 * database, which counts as activity: the free plan pauses a project that sits idle for about a
 * week, and a paused database would stop guide pages from refreshing. It reports only counts.
 */
export async function GET() {
  try {
    const hikes = await (await getStore()).list();
    return Response.json({ ok: true, store: contentStoreKind(), hikes: hikes.length, published: hikes.filter((h) => h.status === "published").length });
  } catch {
    return Response.json({ ok: false, store: contentStoreKind() }, { status: 503 });
  }
}
