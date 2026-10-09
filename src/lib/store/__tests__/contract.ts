import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ContentStore, Editor } from "../types";

/**
 * The behaviour every ContentStore must have, whatever it stores to. Run against each backend
 * (local.test.ts, supabase.test.ts) with Cedar Ridge, the baseline hike, as the fixture.
 * `slug` must be unique to the run; the suite creates it and removes it.
 */
export function describeStoreContract(name: string, makeStore: () => ContentStore | Promise<ContentStore>, slug: string) {
  const fixture = (file: string) => readFileSync(`fixtures/hikes/cedar-ridge/${file}`, "utf8");
  const mdx = fixture("index.mdx").replace("slug: cedar-ridge", `slug: ${slug}`);
  const waypoints = fixture("waypoints.json");
  const track = JSON.parse(fixture("track.json"));
  const editor: Editor = { id: "00000000-0000-4000-8000-000000000001", name: "Contract Test", role: "owner" };

  describe(`ContentStore contract: ${name}`, () => {
    let store: ContentStore;
    let version: string;

    beforeAll(async () => {
      store = await makeStore();
      await store.remove(slug);
    });
    afterAll(async () => {
      await store.remove(slug);
    });

    it("creates a hike and reads it back unchanged", async () => {
      const r = await store.create(slug, { mdx, waypoints, track }, { editor });
      expect(r).toMatchObject({ ok: true, status: "draft" });
      const hike = await store.read(slug);
      expect(hike).not.toBeNull();
      expect(hike!.mdx).toBe(mdx);
      // Byte for byte: pins are stored as written, their keys in the order they were written.
      expect(hike!.waypoints).toBe(waypoints);
      expect(hike!.track).toEqual(track);
      expect(hike!.status).toBe("draft");
      version = hike!.version;
      expect(r.ok && r.version).toBe(version);
    });

    it("lists it with its validated details", async () => {
      const row = (await store.list()).find((h) => h.slug === slug);
      expect(row).toMatchObject({ status: "draft", details: { title: "Cedar Ridge", distanceMi: 7.3 }, publishedDetails: null, changed: false });
      expect((await store.read(slug))!).toMatchObject({ published: null, changed: false });
    });

    it("refuses to create a hike that already exists", async () => {
      expect(await store.create(slug, { mdx, waypoints }, { editor })).toEqual({ ok: false, kind: "exists" });
    });

    it("saves a change and hands back a new version", async () => {
      const next = mdx.replace("<RouteMap />", "<RouteMap height={420} />");
      const r = await store.save(slug, { mdx: next, waypoints }, { editor, baseVersion: version });
      expect(r.ok).toBe(true);
      const hike = (await store.read(slug))!;
      expect(hike.mdx).toBe(next);
      expect(hike.version).not.toBe(version);
      expect(hike.track).toEqual(track); // a text save never touches the track
      expect(r.ok && r.version).toBe(hike.version);
      version = hike.version;
    });

    it.each([
      ["a mistyped prop", (m: string) => m.replace("<RouteMap height={420} />", "<RouteMap heigth={1} />"), /unknown prop "heigth"/],
      ["code in the guide", (m: string) => `${m}\n{process.env.SECRET}\n`, /can't contain \{…\} expressions/],
      ["an import", (m: string) => m.replace("\n\n*This guide", "\n\nimport x from 'fs'\n\n*This guide"), /import or export/],
      ["a script tag", (m: string) => `${m}\n<script>alert(1)</script>\n`, /isn't allowed in a guide/],
      ["a pin that doesn't exist", (m: string) => m.replace('<Step waypoint="saddle" />', '<Step waypoint="nowhere" />'), /doesn't match any waypoint/],
      ["invalid details", (m: string) => m.replace("difficulty: hard", "difficulty: brutal"), /difficulty/],
      ["a slug that isn't its own", (m: string) => m.replace(`slug: ${slug}`, "slug: other-hike"), /slug must be/],
    ])("refuses %s and writes nothing", async (_what, change, message) => {
      const r = await store.save(slug, { mdx: change((await store.read(slug))!.mdx), waypoints }, { editor, baseVersion: version });
      expect(r).toMatchObject({ ok: false, kind: "invalid" });
      expect(!r.ok && r.kind === "invalid" && r.problems.join("\n")).toMatch(message);
      expect((await store.read(slug))!.version).toBe(version);
    });

    it("keeps every saved version in the history, newest first (databases only)", async () => {
      const history = await store.history(slug);
      if (store.kind === "local") {
        expect(history).toEqual([]);
        expect(await store.revision(slug, "1")).toBeNull();
        return;
      }
      expect(history.map((r) => r.version)).toEqual([version, ...history.slice(1).map((r) => r.version)]);
      expect(history).toHaveLength(2);
      expect(history[0]).toMatchObject({ status: "draft", savedBy: editor.name });
      expect(Date.parse(history[0].savedAt)).not.toBeNaN();
      const first = await store.revision(slug, history[1].version);
      expect(first).toEqual({ mdx, waypoints });
      expect(await store.revision(slug, "999")).toBeNull();
      expect(await store.revision(slug, "not-a-version")).toBeNull();
      expect((await store.history(slug, 1)).map((r) => r.version)).toEqual([version]);
    });

    it("refuses invalid pins", async () => {
      const r = await store.save(slug, { mdx: (await store.read(slug))!.mdx, waypoints: '{"waypoints":[{"id":"Bad Id"}]}' }, { editor, baseVersion: version });
      expect(r).toMatchObject({ ok: false, kind: "invalid" });
      expect((await store.read(slug))!.version).toBe(version);
    });

    it("refuses a save based on a stale version instead of overwriting", async () => {
      const before = (await store.read(slug))!;
      const r = await store.save(slug, { mdx: before.mdx.replace("7.3 miles", "9.9 miles"), waypoints }, { editor, baseVersion: "stale-version" });
      expect(r).toEqual({ ok: false, kind: "conflict", version });
      expect((await store.read(slug))!.mdx).toBe(before.mdx);
    });

    it("publishes the working copy; saves after that don't reach the published copy until it's published again", async () => {
      expect(await store.publish(slug, { editor, baseVersion: "stale-version" })).toEqual({ ok: false, kind: "conflict", version });
      expect(await store.publish("zz-no-such-hike", { editor, baseVersion: "x" })).toEqual({ ok: false, kind: "not_found" });

      const working = (await store.read(slug))!;
      expect(await store.publish(slug, { editor, baseVersion: version })).toEqual({ ok: true, version, status: "published" });
      let hike = (await store.read(slug))!;
      expect(hike).toMatchObject({ status: "published", changed: false, version, published: { mdx: working.mdx, waypoints: working.waypoints } });
      expect(Date.parse(hike.published!.at!)).not.toBeNaN();
      let row = (await store.list()).find((h) => h.slug === slug)!;
      expect(row).toMatchObject({ status: "published", changed: false, publishedDetails: { title: "Cedar Ridge" } });

      // A save changes the working copy only.
      const edited = working.mdx.replace("title: Cedar Ridge", "title: Cedar Ridge (edited)");
      const saved = await store.save(slug, { mdx: edited, waypoints }, { editor, baseVersion: version });
      expect(saved).toMatchObject({ ok: true, status: "published" });
      hike = (await store.read(slug))!;
      expect(hike).toMatchObject({ mdx: edited, changed: true, published: { mdx: working.mdx } });
      row = (await store.list()).find((h) => h.slug === slug)!;
      expect(row).toMatchObject({ changed: true, details: { title: "Cedar Ridge (edited)" }, publishedDetails: { title: "Cedar Ridge" } });

      // Publishing again brings the published copy up to date.
      expect(await store.publish(slug, { editor, baseVersion: hike.version })).toMatchObject({ ok: true });
      expect((await store.read(slug))!).toMatchObject({ changed: false, published: { mdx: edited } });

      // Unpublish keeps the working copy.
      expect(await store.unpublish(slug, { editor, baseVersion: "stale-version" })).toMatchObject({ ok: false, kind: "conflict" });
      expect(await store.unpublish(slug, { editor, baseVersion: hike.version })).toEqual({ ok: true, version: hike.version, status: "draft" });
      hike = (await store.read(slug))!;
      expect(hike).toMatchObject({ status: "draft", published: null, changed: false, mdx: edited });
      expect((await store.list()).find((h) => h.slug === slug)).toMatchObject({ status: "draft", publishedDetails: null });
      version = hike.version;
    });

    it("refuses the address the app keeps for itself", async () => {
      const r = await store.create("new", { mdx: mdx.replace(`slug: ${slug}`, "slug: new"), waypoints }, { editor });
      expect(r).toMatchObject({ ok: false, kind: "invalid" });
      expect(await store.read("new")).toBeNull();
    });

    it("replaces and removes the track without touching the text", async () => {
      const before = (await store.read(slug))!;
      const off = await store.setTrack(slug, null, { editor, baseVersion: version });
      expect(off.ok).toBe(true);
      let hike = (await store.read(slug))!;
      expect(hike.track).toBeNull();
      expect(hike.mdx).toBe(before.mdx);
      const on = await store.setTrack(slug, track, { editor, baseVersion: hike.version });
      expect(on.ok).toBe(true);
      hike = (await store.read(slug))!;
      expect(hike.track).toEqual(track);
      version = hike.version;
    });

    it("says not found for a hike that doesn't exist", async () => {
      expect(await store.read("zz-no-such-hike")).toBeNull();
      expect(await store.save("zz-no-such-hike", { mdx, waypoints }, { editor, baseVersion: "x" })).toEqual({ ok: false, kind: "not_found" });
    });

    it("deletes a draft only at the version last seen, and never a published guide", async () => {
      expect(await store.deleteDraft(slug, { editor, baseVersion: "stale-version" })).toEqual({ ok: false, kind: "conflict", version });
      expect(await store.deleteDraft("zz-no-such-hike", { editor, baseVersion: "x" })).toEqual({ ok: false, kind: "not_found" });

      expect(await store.publish(slug, { editor, baseVersion: version })).toMatchObject({ ok: true });
      expect(await store.deleteDraft(slug, { editor, baseVersion: version })).toEqual({ ok: false, kind: "published" });
      expect(await store.read(slug)).not.toBeNull();

      expect(await store.unpublish(slug, { editor, baseVersion: version })).toMatchObject({ ok: true, status: "draft" });
      expect(await store.deleteDraft(slug, { editor, baseVersion: version })).toEqual({ ok: true });
      expect(await store.read(slug)).toBeNull();
      expect((await store.list()).some((h) => h.slug === slug)).toBe(false);
    });

    it("can create a hike again at the address of a deleted draft", async () => {
      const r = await store.create(slug, { mdx, waypoints, track }, { editor });
      expect(r).toMatchObject({ ok: true, status: "draft" });
      expect(r.ok && r.version).toBe((await store.read(slug))!.version);
    });

    it("removes a hike", async () => {
      await store.remove(slug);
      expect(await store.read(slug)).toBeNull();
      expect((await store.list()).some((h) => h.slug === slug)).toBe(false);
    });
  });
}
