import { describe, expect, it } from "vitest";
import { findComponentAt, listComponents, openingTagEnd, serializeOpeningTag, setComponentProps } from "../jsx-source";

const DOC = `---
title: T
---

Intro.

<RouteMap height={420} labels={false} />

<Step waypoint="saddle">

Notes with a <PhotoCard waypoint="saddle" caption="Look > here" /> inline.

</Step>
`;

describe("listComponents / findComponentAt", () => {
  it("finds components with offsets that match the original source (frontmatter included)", () => {
    const list = listComponents(DOC);
    expect(list.map((c) => c.name)).toEqual(["RouteMap", "Step", "PhotoCard"]);
    for (const c of list) expect(DOC.slice(c.start, c.start + c.name.length + 1)).toBe(`<${c.name}`);
  });

  it("reads literal props", () => {
    const [map, step, card] = listComponents(DOC);
    expect(map.props).toEqual({ height: 420, labels: false });
    expect(map.selfClosing).toBe(true);
    expect(step.props).toEqual({ waypoint: "saddle" });
    expect(step.selfClosing).toBe(false);
    expect(card.props).toEqual({ waypoint: "saddle", caption: "Look > here" });
  });

  it("picks the innermost component under the cursor", () => {
    expect(findComponentAt(DOC, DOC.indexOf("PhotoCard") + 3)?.name).toBe("PhotoCard");
    expect(findComponentAt(DOC, DOC.indexOf("Notes"))?.name).toBe("Step");
    expect(findComponentAt(DOC, DOC.indexOf("Intro"))).toBeNull();
  });

  it("returns nothing for a document that doesn't parse (mid-edit)", () => {
    expect(listComponents("<RouteMap height={")).toEqual([]);
  });
});

describe("openingTagEnd", () => {
  it("skips > inside quotes and braces", () => {
    const src = '<PhotoCard caption="a > b" x={1 > 0} />rest';
    expect(src.slice(0, openingTagEnd(src, 0))).toBe('<PhotoCard caption="a > b" x={1 > 0} />');
  });
});

describe("serializeOpeningTag", () => {
  it("drops defaults and empty values and orders props like the manifest", () => {
    expect(serializeOpeningTag("RouteMap", { terrain: false, height: 320, labels: true }, {}, true)).toBe("<RouteMap terrain={false} />");
  });

  it("writes strings, bare true, numbers, and quotes containing quotes", () => {
    expect(serializeOpeningTag("PhotoCard", { waypoint: "saddle", caption: 'the "notch"' }, {}, true)).toBe(
      '<PhotoCard waypoint="saddle" caption={"the \\"notch\\""} />',
    );
    expect(serializeOpeningTag("Step", { waypoint: "a", hidePhoto: true }, {}, false)).toBe('<Step waypoint="a" hidePhoto>');
  });

  it("keeps internal flags and expressions it can't evaluate", () => {
    expect(serializeOpeningTag("Step", { waypoint: "a", auto: true }, {}, true)).toBe('<Step waypoint="a" auto />');
    expect(serializeOpeningTag("RouteMap", {}, { height: "2 * 200" }, true)).toBe("<RouteMap height={2 * 200} />");
  });
});

describe("setComponentProps", () => {
  it("rewrites only the opening tag and keeps the content", () => {
    const step = listComponents(DOC)[1];
    const out = setComponentProps(DOC, step, { ...step.props, hidePhoto: true });
    expect(out).toBe(DOC.replace('<Step waypoint="saddle">', '<Step waypoint="saddle" hidePhoto>'));
    expect(listComponents(out)[1].props).toEqual({ waypoint: "saddle", hidePhoto: true });
  });
});
