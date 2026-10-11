import "server-only";
import { hikeGuests } from "../../db/schema";
import { getDatabase } from "../store/server";
import type { Editor } from "../store/types";

/**
 * Makes a hike a guest's own, so they can open what they just created. Only a real signed-in
 * guest has anything to record: owners and editors may open everything already.
 */
export async function grantHike(editor: Editor, slug: string): Promise<void> {
  if (editor.role !== "guest") return;
  await getDatabase().insert(hikeGuests).values({ slug, userId: editor.id }).onConflictDoNothing();
}
