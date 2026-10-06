import { Document, isMap, parseDocument } from "yaml";
import { FRONTMATTER } from "./mdx/plugins";

/**
 * A guide document is a YAML frontmatter block (the guide's details) followed by the MDX body.
 * The editor's Write view edits the body and its details form edits the frontmatter; these
 * helpers take a document apart and put it back without disturbing the part that wasn't edited.
 */

export type GuideDoc = {
  /** The YAML between the `---` lines, without them. Empty if the document has no frontmatter. */
  yaml: string;
  /** Everything after the frontmatter block, without the blank lines that separate them. */
  body: string;
};

export function splitGuide(mdx: string): GuideDoc {
  const m = FRONTMATTER.exec(mdx);
  if (!m) return { yaml: "", body: mdx.replace(/^\n+/, "") };
  return { yaml: m[1], body: mdx.slice(m[0].length).replace(/^\n+/, "") };
}

export function joinGuide({ yaml, body }: GuideDoc): string {
  const text = body.replace(/^\n+/, "").replace(/\s*$/, "\n");
  return yaml.trim() ? `---\n${yaml.replace(/\s*$/, "")}\n---\n\n${text}` : text;
}

/** The frontmatter as plain data (unvalidated), or {} if it's missing or not a mapping. */
export function readDetails(yaml: string): Record<string, unknown> {
  try {
    const data: unknown = parseDocument(yaml).toJS();
    return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Sets one value in the frontmatter YAML, by path (`["essentials", "parking"]`). Only that entry
 * changes: the other lines, their order, quoting and comments stay as written. `undefined`, an
 * empty string or an empty list removes the entry, and a parent mapping left empty is removed too.
 */
export function setDetail(yaml: string, path: (string | number)[], value: unknown): string {
  const parsed = parseDocument(yaml);
  // Anything that isn't a mapping (empty, or a stray scalar) starts over as an empty one.
  const doc = isMap(parsed.contents) ? parsed : new Document({});
  const empty = value === undefined || value === "" || value === null || (Array.isArray(value) && value.length === 0);
  if (empty) {
    doc.deleteIn(path);
    for (let depth = path.length - 1; depth > 0; depth--) {
      const parent = doc.getIn(path.slice(0, depth));
      if (isMap(parent) && parent.items.length === 0) doc.deleteIn(path.slice(0, depth));
      else break;
    }
  } else {
    doc.setIn(path, value);
  }
  return doc.toString({ lineWidth: 0 }).replace(/\s*$/, "");
}
