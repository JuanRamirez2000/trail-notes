import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { localBackend } from "../local";
import { createStore } from "../store";
import { describeStoreContract } from "./contract";

const root = mkdtempSync(path.join(tmpdir(), "trailnotes-store-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

describeStoreContract("local files", () => createStore(localBackend(root)), "zz-contract-local");

describe("local files: things only files can do", () => {
  const store = createStore(localBackend(root));

  it("notices an edit made outside the editor as a conflict", async () => {
    const real = createStore(localBackend()); // content/hikes, read-only here
    const sp = (await real.read("strawberry-peak"))!;
    const slug = "zz-outside-edit";
    const mdx = sp.mdx.replace("slug: strawberry-peak", `slug: ${slug}`);
    const created = await store.create(slug, { mdx, waypoints: sp.waypoints }, { editor: null });
    expect(created.ok).toBe(true);
    writeFileSync(path.join(root, slug, "index.mdx"), mdx.replace("7.3 miles", "7.4 miles"));
    const r = await store.save(slug, { mdx, waypoints: sp.waypoints }, { editor: null, baseVersion: created.ok ? created.version : "" });
    expect(r).toMatchObject({ ok: false, kind: "conflict" });
  });

  it("still opens a hand-edited guide that is invalid, flagged in the list", async () => {
    const slug = "zz-broken";
    const sp = (await createStore(localBackend()).read("strawberry-peak"))!;
    await store.create(slug, { mdx: sp.mdx.replace("slug: strawberry-peak", `slug: ${slug}`), waypoints: sp.waypoints }, { editor: null });
    writeFileSync(path.join(root, slug, "index.mdx"), "---\ntitle: Broken\n---\n\nNo details.\n");
    writeFileSync(path.join(root, slug, "waypoints.json"), "{ not json");
    const hike = await store.read(slug);
    expect(hike?.mdx).toContain("No details.");
    expect(hike?.waypoints).toBe("{ not json"); // exact text kept, so nothing is lost before it's fixed
    expect((await store.list()).find((h) => h.slug === slug)).toMatchObject({ details: null, status: "draft" });
  });

  it("doesn't delete a track file it can't read when the guide is saved", async () => {
    const slug = "zz-bad-track";
    const sp = (await createStore(localBackend()).read("strawberry-peak"))!;
    const mdx = sp.mdx.replace("slug: strawberry-peak", `slug: ${slug}`);
    await store.create(slug, { mdx, waypoints: sp.waypoints, track: sp.track }, { editor: null });
    const trackPath = path.join(root, slug, "track.json");
    const broken = readFileSync(trackPath, "utf8").replace(/"distanceMi":[\d.]+/, '"distanceMi":"far"');
    writeFileSync(trackPath, broken);
    const hike = (await store.read(slug))!;
    expect(hike.track).toBeNull();
    const r = await store.save(slug, { mdx, waypoints: sp.waypoints }, { editor: null, baseVersion: hike.version });
    expect(r).toMatchObject({ ok: false, kind: "invalid", problems: [expect.stringContaining("track.json")] });
    expect(readFileSync(trackPath, "utf8")).toBe(broken);
    // Importing the recording again is the way out.
    expect((await store.setTrack(slug, sp.track, { editor: null, baseVersion: hike.version })).ok).toBe(true);
  });

  it("lets only one of two saves from the same version through", async () => {
    const slug = "zz-two-saves";
    const sp = (await createStore(localBackend()).read("strawberry-peak"))!;
    const mdx = sp.mdx.replace("slug: strawberry-peak", `slug: ${slug}`);
    const created = await store.create(slug, { mdx, waypoints: sp.waypoints }, { editor: null });
    const base = created.ok ? created.version : "";
    const results = await Promise.all(["7.4 miles", "7.5 miles"].map((d) => store.save(slug, { mdx: mdx.replace("7.3 miles", d), waypoints: sp.waypoints }, { editor: null, baseVersion: base })));
    expect(results.map((r) => (r.ok ? "ok" : r.kind)).sort()).toEqual(["conflict", "ok"]);
  });

  it("reads every real guide in content/hikes", async () => {
    const hikes = await createStore(localBackend()).list();
    // The baseline and the two sample drafts; other hikes may be added next to them.
    expect(hikes.map((h) => h.slug)).toEqual(expect.arrayContaining(["granite-saddle", "ridgeline-loop", "strawberry-peak"]));
    expect(hikes.every((h) => h.details !== null)).toBe(true);
    expect(hikes.find((h) => h.slug === "strawberry-peak")?.status).toBe("published");
  });
});
