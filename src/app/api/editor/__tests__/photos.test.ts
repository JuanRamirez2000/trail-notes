import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { localBackend } from "@/lib/store/local";
import { createStore } from "@/lib/store/store";
import type { Editor } from "@/lib/store/types";

/**
 * The photo routes, called the way Next calls them, against a temp copy of fixtures/hikes and a
 * photo store kept in memory. Cedar Ridge is the useful case: it's published, its pins use
 * six photos, and its cover (03-img-8958) is on no pin.
 */
const root = mkdtempSync(path.join(tmpdir(), "trailnotes-photos-"));
cpSync("fixtures/hikes", root, { recursive: true });
afterAll(() => rmSync(root, { recursive: true, force: true }));

const OWNER: Editor = { id: "owner-1", name: "Owner", role: "owner" };
const state = vi.hoisted(() => ({
  editor: null as unknown,
  files: new Set<string>(),
  signed: [] as string[],
  storeKind: "local" as "local" | "postgres",
  down: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/auth/server", () => ({ getEditor: async () => state.editor }));
vi.mock("@/lib/store/server", () => ({ getStore: async () => ({ ...createStore(localBackend(root)), kind: state.storeKind }) }));
vi.mock("@/lib/photo-store", async (original) => {
  const real = await original<typeof import("@/lib/photo-store")>();
  return {
    ...real,
    getPhotoStore: async () => {
      if (state.down) throw new real.PhotoStoreUnavailable("No key.");
      return {
        kind: "local",
        list: async (slug: string) => [...state.files].filter((f) => f.startsWith(`${slug}/`)).map((f) => f.slice(slug.length + 1)),
        signUploads: async (objects: string[]) => {
          state.signed.push(...objects);
          return objects.map((o) => ({ url: `https://storage.example/${o}?token=t`, headers: {} }));
        },
        remove: async (objects: string[]) => objects.forEach((o) => state.files.delete(o)),
        removeFolder: async (slug: string) => [...state.files].filter((f) => f.startsWith(`${slug}/`)).forEach((f) => state.files.delete(f)),
      };
    },
  };
});

const { GET, POST, DELETE } = await import("../[slug]/photos/route");
const { purgeExpiredHikes } = await import("@/lib/purge");

const ORIGIN = "https://trailnotes.example";
const store = createStore(localBackend(root));
const call = (handler: typeof POST, method: string, slug: string, body?: unknown, headers: Record<string, string> = {}) =>
  handler(
    new Request(`${ORIGIN}/api/editor/${slug}/photos`, {
      method,
      headers: { origin: ORIGIN, host: "trailnotes.example", "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug }) },
  );
const file = (name: string, bytes = 1000) => ({ name, fullBytes: bytes, thumbBytes: 100 });
const both = (key: string) => [`${key}.full.webp`, `${key}.thumb.webp`];

beforeEach(() => {
  state.editor = OWNER;
  state.storeKind = "local";
  state.down = false;
  state.signed = [];
  state.files = new Set(["01-img-8950", "02-img-8956", "03-img-8958", "04-img-8959", "05-img-8962", "06-img-8968", "07-img-8957"].flatMap((n) => both(`cedar-ridge/${n}`)));
});

describe("the photo routes", () => {
  it("are a 404 for anyone who isn't an editor, and for a hike that doesn't exist", async () => {
    for (const who of [null, { id: "x", name: "X", role: "viewer" }]) {
      state.editor = who;
      expect((await call(GET, "GET", "cedar-ridge")).status).toBe(404);
      expect((await call(POST, "POST", "cedar-ridge", { files: [file("a.jpg")] }, { origin: "https://evil.example" })).status).toBe(404);
      expect((await call(DELETE, "DELETE", "cedar-ridge", { key: "cedar-ridge/07-img-8957" })).status).toBe(404);
    }
    state.editor = OWNER;
    expect((await call(GET, "GET", "no-such-hike")).status).toBe(404);
    expect((await call(POST, "POST", "no-such-hike", { files: [file("a.jpg")] })).status).toBe(404);
    expect((await call(POST, "POST", "../etc", { files: [file("a.jpg")] })).status).toBe(404);
    expect(state.signed).toEqual([]);
  });

  it("refuse a change that doesn't come from the site's own pages", async () => {
    expect((await call(POST, "POST", "cedar-ridge", { files: [file("a.jpg")] }, { origin: "https://evil.example" })).status).toBe(403);
    expect((await call(DELETE, "DELETE", "cedar-ridge", { key: "cedar-ridge/99-x" }, { origin: "https://evil.example" })).status).toBe(403);
  });

  it("say so when photo storage isn't set up", async () => {
    state.down = true;
    const res = await call(POST, "POST", "cedar-ridge", { files: [file("a.jpg")] });
    expect(res.status).toBe(503);
    expect((await res.json()).problems).toEqual(["No key."]);
  });
});

describe("GET photos", () => {
  it("lists the hike's photos as keys, once each", async () => {
    const res = await call(GET, "GET", "cedar-ridge");
    expect(res.status).toBe(200);
    expect((await res.json()).keys).toEqual(["01-img-8950", "02-img-8956", "03-img-8958", "04-img-8959", "05-img-8962", "06-img-8968", "07-img-8957"].map((n) => `cedar-ridge/${n}`));
  });
});

describe("POST photos", () => {
  it("numbers new photos after everything stored, and signs both variants of each", async () => {
    const res = await call(POST, "POST", "cedar-ridge", { files: [file("IMG_9001.JPG"), file("Summit view (2).heic")] });
    expect(res.status).toBe(200);
    const { photos } = await res.json();
    expect(photos.map((p: { key: string }) => p.key)).toEqual(["cedar-ridge/08-img-9001", "cedar-ridge/09-summit-view-2"]);
    expect(state.signed).toEqual([...both("cedar-ridge/08-img-9001"), ...both("cedar-ridge/09-summit-view-2")]);
    expect(photos[0].full.url).toContain("08-img-9001.full.webp");
    expect(photos[0].thumb.url).toContain("08-img-9001.thumb.webp");
  });

  it("numbers after the pins too, when their files are missing from storage", async () => {
    state.files.clear();
    const { photos } = await (await call(POST, "POST", "cedar-ridge", { files: [file("a.jpg")] })).json();
    expect(photos[0].key).toBe("cedar-ridge/08-a");
  });

  it("makes the path itself: a name can't choose a folder or a file", async () => {
    const { photos } = await (await call(POST, "POST", "cedar-ridge", { files: [file("../../granite-saddle/01-x.full.webp")] })).json();
    expect(photos[0].key).toBe("cedar-ridge/08-granite-saddle-01-x-full");
  });

  it("refuses a malformed request, too many photos, or one that's too large", async () => {
    const tooMany = Array.from({ length: 31 }, (_, i) => file(`p${i}.jpg`));
    for (const bad of ["{ not json", "null", {}, { files: [] }, { files: tooMany }, { files: [file("a.jpg", 21 * 1024 * 1024)] }, { files: [file("...")] }, { files: [{ name: "a.jpg" }] }, { files: [file("a.jpg", 1.5)] }]) {
      expect((await call(POST, "POST", "cedar-ridge", bad)).status, JSON.stringify(bad).slice(0, 60)).toBe(400);
    }
    expect(state.signed).toEqual([]);
  });
});

describe("DELETE photos", () => {
  const remove = (key: unknown, slug = "cedar-ridge") => call(DELETE, "DELETE", slug, { key });

  it("refuses a photo a pin uses, and the cover, which no pin uses", async () => {
    for (const key of ["cedar-ridge/07-img-8957", "cedar-ridge/03-img-8958"]) {
      const res = await remove(key);
      expect(res.status, key).toBe(409);
      expect((await res.json()).problems[0]).toMatch(/still used/);
    }
    expect(state.files.size).toBe(14);
  });

  it("refuses a photo only the published page still uses", async () => {
    const g = (await store.read("cedar-ridge"))!;
    const pins = JSON.parse(g.waypoints) as { waypoints: { id: string; photo?: unknown }[] };
    for (const w of pins.waypoints) if (w.id === "saddle") delete w.photo;
    const saved = await store.save("cedar-ridge", { mdx: g.mdx, waypoints: JSON.stringify(pins, null, 2) }, { editor: OWNER, baseVersion: g.version });
    expect(saved.ok).toBe(true);
    expect((await remove("cedar-ridge/07-img-8957")).status).toBe(409);
    expect(state.files.has("cedar-ridge/07-img-8957.full.webp")).toBe(true);
  });

  it("deletes both files of a photo nothing uses, and isn't fooled by a longer name", async () => {
    both("cedar-ridge/08-extra").forEach((f) => state.files.add(f));
    both("cedar-ridge/07-img-895").forEach((f) => state.files.add(f));
    expect((await remove("cedar-ridge/08-extra")).status).toBe(200);
    expect((await remove("cedar-ridge/07-img-895")).status).toBe(200);
    expect(state.files.size).toBe(14);
  });

  it("only takes a key in this hike's folder", async () => {
    for (const key of ["granite-saddle/01-img-3101", "cedar-ridge/../granite-saddle/01-img-3101", "cedar-ridge", 7, undefined]) expect((await remove(key)).status, String(key)).toBe(400);
  });

  it("deletes nothing when the guides are in files but the photos are in shared storage", async () => {
    state.storeKind = "postgres"; // with the fake store's kind "local": a mismatch either way round
    both("cedar-ridge/08-extra").forEach((f) => state.files.add(f));
    expect((await remove("cedar-ridge/08-extra")).status).toBe(409);
    expect(state.files.has("cedar-ridge/08-extra.full.webp")).toBe(true);
  });
});

describe("removing deleted hikes for good", () => {
  const DAY = 24 * 3_600_000;
  const schedule = async (slug: string, daysAgo: number) => {
    const g = (await store.read(slug))!;
    expect(await store.scheduleDelete(slug, { editor: OWNER, baseVersion: g.version, now: new Date(Date.now() - daysAgo * DAY) })).toMatchObject({ ok: true });
  };

  it("leaves a hike deleted less than 72 hours ago, photos and all", async () => {
    both("ridgeline-loop/01-a").forEach((f) => state.files.add(f));
    await schedule("ridgeline-loop", 2);
    expect(await purgeExpiredHikes()).toEqual([]);
    expect(await store.read("ridgeline-loop")).not.toBeNull();
    expect(state.files.has("ridgeline-loop/01-a.full.webp")).toBe(true);
    await store.cancelDelete("ridgeline-loop");
  });

  it("removes one deleted more than 72 hours ago, with its photo folder and nobody else's", async () => {
    both("ridgeline-loop/01-a").forEach((f) => state.files.add(f));
    await schedule("ridgeline-loop", 4);
    expect(await purgeExpiredHikes()).toEqual(["ridgeline-loop"]);
    expect(await store.read("ridgeline-loop")).toBeNull();
    expect([...state.files].some((f) => f.startsWith("ridgeline-loop/"))).toBe(false);
    expect(state.files.size).toBe(14);
    expect(await store.read("cedar-ridge")).not.toBeNull();
  });

  it("keeps the hike for the next visit when its photos can't be removed now", async () => {
    await schedule("granite-saddle", 4);
    state.down = true;
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await purgeExpiredHikes()).toEqual([]);
    quiet.mockRestore();
    expect(await store.read("granite-saddle")).not.toBeNull();
    state.down = false;
    expect(await purgeExpiredHikes()).toEqual(["granite-saddle"]);
  });
});
