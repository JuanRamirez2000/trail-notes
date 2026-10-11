import type { Editor } from "../store/types";

export type EditorAction = "list" | "read" | "save" | "create" | "delete" | "publish" | "photos";

/**
 * The one place that decides what a signed-in person may do.
 *
 *  - An owner or an editor may do everything, to every hike.
 *  - A guest may see the hike list (theirs only: the list filters with this same function) and
 *    create hikes, and may read, save, add photos to, publish and delete **their own** hikes:
 *    the ones they created or were given (`editor.hikes`). Any other hike doesn't exist for them.
 *
 * It takes the hike on every call about a hike; an action on a hike asked without one is refused
 * for a guest rather than allowed.
 */
export function can(editor: Editor | null, action: EditorAction, slug?: string): editor is Editor {
  if (!editor) return false;
  if (editor.role === "owner" || editor.role === "editor") return true;
  if (editor.role !== "guest") return false;
  if (action === "list" || action === "create") return true;
  return slug !== undefined && (editor.hikes ?? []).includes(slug);
}
