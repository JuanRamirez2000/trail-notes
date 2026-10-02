// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { createProcessor } from "@mdx-js/mdx";
import { MDXEditor, type MDXEditorMethods } from "@mdxeditor/editor";
import { act, cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { editorPlugins, toMarkdownOptions } from "../mdx-editor-config";

afterEach(cleanup);

/** Loads markdown into a real MDXEditor (jsdom) and reads it back, as the Write mode will. */
async function roundTrip(source: string) {
  const ref = createRef<MDXEditorMethods>();
  const errors: string[] = [];
  await act(async () => {
    render(
      <MDXEditor
        ref={ref}
        markdown={source}
        onError={(e) => errors.push(e.error)}
        toMarkdownOptions={toMarkdownOptions}
        plugins={editorPlugins()}
      />,
    );
  });
  return { out: ref.current!.getMarkdown(), errors };
}

const FM = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Frontmatter as data, body as an MDX syntax tree without positions: what the build actually sees. */
function structure(src: string) {
  const m = FM.exec(src);
  const strip = (n: unknown): unknown =>
    Array.isArray(n)
      ? n.map(strip)
      : n && typeof n === "object"
        ? Object.fromEntries(Object.entries(n).filter(([k]) => k !== "position").map(([k, v]) => [k, strip(v)]))
        : n;
  return { frontmatter: m ? parseYaml(m[1]) : null, body: strip(createProcessor().parse(m ? src.slice(m[0].length) : src)) };
}

const TRICKY = `---
title: Tricky
slug: tricky
---

Intro with _underscore_ and *star* emphasis, **bold**, \`code\`, and a [link](https://example.com "title").

{/* An author comment the editor must keep */}

<RouteMap height={420} labels terrain={false} />

- one
  - nested
- two

1. first
2. second

<Step waypoint="fork">

### A heading inside a step

Paragraph one.

Paragraph two with a [link](/x).

- a list inside a step

</Step>

<Step waypoint="end" hidePhoto />

> A quote.

---

Last line.
`;

const cases: [string, string][] = [
  ...["strawberry-peak", "granite-saddle", "ridgeline-loop"].map((slug) => [slug, readFileSync(`content/hikes/${slug}/index.mdx`, "utf8")] as [string, string]),
  ["tricky syntax", TRICKY],
];

describe("MDXEditor round trip (V2 Write mode)", () => {
  it.each(cases)("%s: same frontmatter and MDX structure, stable on a second pass", async (_name, src) => {
    const { out, errors } = await roundTrip(src);
    expect(errors).toEqual([]);
    expect(structure(out)).toEqual(structure(src));
    expect((await roundTrip(out)).out).toBe(out);
  });

  it("leaves the baseline guide (Strawberry Peak) byte-for-byte unchanged apart from the final newline", async () => {
    const src = readFileSync("content/hikes/strawberry-peak/index.mdx", "utf8");
    expect(`${(await roundTrip(src)).out}\n`).toBe(src);
  });
});
