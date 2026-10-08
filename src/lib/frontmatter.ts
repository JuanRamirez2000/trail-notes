import { Document, isMap, parseDocument } from "yaml";

/**
 * A guide document is a YAML frontmatter block (the guide's details) followed by the MDX body.
 * The editor's Write view edits the body and its details form edits the frontmatter; these
 * helpers take a document apart and put it back without disturbing the part that wasn't edited.
 */

/** The frontmatter block at the top of a guide; group 1 is the YAML between the `---` lines. */
export const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * The guide with its frontmatter blanked out, for handing to the MDX compiler (frontmatter isn't
 * MDX). Every character becomes a space and newlines stay, so line numbers and offsets still
 * match the source.
 */
export const blankFrontmatter = (source: string) => source.replace(FRONTMATTER, (m) => m.replace(/[^\r\n]/g, " "));

export type GuideDoc = {
  /** The YAML between the `---` lines, without them. Empty if the document has no frontmatter. */
  yaml: string;
  /** Everything after the frontmatter block, without the blank lines that separate them. */
  body: string;
};

export function splitGuide(mdx: string): GuideDoc {
  const m = FRONTMATTER.exec(mdx);
  if (!m) return { yaml: "", body: mdx.replace(/^[\r\n]+/, "") };
  return { yaml: m[1], body: mdx.slice(m[0].length).replace(/^[\r\n]+/, "") };
}

/** Puts a guide back together, with the line endings the two halves already use. */
export function joinGuide({ yaml, body }: GuideDoc): string {
  const eol = /\r\n/.test(yaml + body) ? "\r\n" : "\n";
  const text = body.replace(/^[\r\n]+/, "").replace(/\s*$/, eol);
  return yaml.trim() ? `---${eol}${yaml.replace(/\s*$/, "")}${eol}---${eol}${eol}${text}` : text;
}

/**
 * What's wrong with the frontmatter as YAML (a tab indent, a duplicate key, an unclosed quote,
 * a list where the details should be), or [] if it can be read and edited. The details form and
 * Publish can't change a frontmatter that has problems; they show these instead.
 */
export function yamlProblems(yaml: string): string[] {
  const doc = parseDocument(yaml);
  if (doc.errors.length) return doc.errors.map((e) => e.message);
  if (doc.contents !== null && !isMap(doc.contents)) return ["The details must be a list of `name: value` lines."];
  return [];
}

/** The frontmatter as plain data (unvalidated), or {} if it's missing, not a mapping or not valid YAML. */
export function readDetails(yaml: string): Record<string, unknown> {
  try {
    const doc = parseDocument(yaml);
    if (doc.errors.length) return {};
    const data: unknown = doc.toJS();
    return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Sets one value in the frontmatter YAML, by path (`["essentials", "parking"]`). Only that entry
 * changes: the other lines, their order, quoting and comments stay as written. `undefined`, an
 * empty string or an empty list removes the entry, and a parent mapping left empty is removed too.
 *
 * Throws if the YAML has problems (see `yamlProblems`): rewriting it could lose what's there.
 */
export function setDetail(yaml: string, path: (string | number)[], value: unknown): string {
  const problems = yamlProblems(yaml);
  if (problems.length) throw new Error(`The guide's details can't be edited until this is fixed: ${problems[0]}`);
  const parsed = parseDocument(yaml);
  // An empty frontmatter starts as an empty mapping.
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
