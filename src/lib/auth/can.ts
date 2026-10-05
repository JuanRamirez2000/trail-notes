import type { Editor } from "../store/types";

export type EditorAction = "list" | "read" | "save" | "create" | "publish";

/**
 * The one place that decides what a signed-in person may do. Today every editor on the list may
 * do everything; it takes the action and the slug so per-hike or per-role rules can be added here
 * later without touching a single caller.
 */
export function can(editor: Editor | null, _action: EditorAction, _slug?: string): editor is Editor {
  if (!editor) return false;
  return editor.role === "owner" || editor.role === "editor";
}
