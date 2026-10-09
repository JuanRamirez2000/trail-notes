import "server-only";
import { getPhotoStore, photosBelongToStore } from "./photo-store";
import { getStore } from "./store/server";

/**
 * Removes for good every hike whose deletion time has passed: its photos, then the guide and its
 * history. Returns the slugs removed.
 *
 * It runs when an editor opens the hike list, not on a timer: photo files can only be deleted as
 * a signed-in editor (the server holds no key of its own), and a timer has nobody to act as. A
 * hike waiting here is already unpublished, so nothing public depends on when this runs.
 *
 * A hike whose photos can't be removed right now is left for the next visit, so photo files
 * never outlive the guide that knew about them.
 */
export async function purgeExpiredHikes(now = new Date()): Promise<string[]> {
  const store = await getStore();
  const expired = (await store.list()).filter((h) => h.deleteAfter && new Date(h.deleteAfter) <= now);
  const removed: string[] = [];
  for (const { slug } of expired) {
    try {
      const photos = await getPhotoStore();
      // Guides in files with photos in the shared bucket: the live site may still use those photos.
      if (photosBelongToStore(store.kind, photos.kind)) await photos.removeFolder(slug);
      await store.remove(slug);
      removed.push(slug);
    } catch (err) {
      console.error(`Couldn't finish deleting "${slug}"; it will be tried again:`, err);
    }
  }
  return removed;
}
