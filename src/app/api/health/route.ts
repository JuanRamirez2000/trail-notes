import { contentStoreKind, getStore } from "@/lib/store/server";

// Always answered live: the point is to touch the store.
export const dynamic = "force-dynamic";

/**
 * A daily scheduled request (vercel.json) hits this. With guides in Supabase it reads from the
 * database, which counts as activity: the free plan pauses a project that sits idle for about a
 * week, and a paused database would stop guide pages from refreshing. It reports only the number
 * of published hikes (drafts aren't public, so neither is how many there are). 503 means the store
 * can't be read: point an uptime monitor at this URL to be told.
 */
export async function GET() {
  try {
    const hikes = await (await getStore()).list();
    return Response.json({ ok: true, store: contentStoreKind(), published: hikes.filter((h) => h.status === "published").length });
  } catch (e) {
    console.error("health: the content store can't be read:", e);
    return Response.json({ ok: false }, { status: 503 });
  }
}
