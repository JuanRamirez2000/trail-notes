import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { localBackend } from "@/lib/store/local";
import { createStore } from "@/lib/store/store";
import type { Editor } from "@/lib/store/types";

/**
 * The editor's two API routes, called the way Next calls them, against a temp copy of
 * content/hikes. Who is signed in and which store is used are the only things replaced.
 */
const root = mkdtempSync(path.join(tmpdir(), "trailnotes-routes-"));
cpSync("content/hikes", root, { recursive: true });
afterAll(() => rmSync(root, { recursive: true, force: true }));

const OWNER: Editor = { id: "owner-1", name: "Owner", role: "owner" };
const state = vi.hoisted(() => ({ editor: null as unknown, revalidated: [] as string[] }));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => undefined }));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => void state.revalidated.push(p) }));
vi.mock("@/lib/auth/server", () => ({ getEditor: async () => state.editor }));
vi.mock("@/lib/store/server", () => ({ getStore: async () => createStore(localBackend(root)) }));

const { PUT, DELETE, GET: getOne } = await import("../[slug]/route");
const { POST, GET: getAll } = await import("../route");
const { GET: getHistory } = await import("../[slug]/history/route");
const { POST: publishRoute, DELETE: unpublishRoute, GET: getPublish } = await import("../[slug]/publish/route");
const { GET: getRevision } = await import("../[slug]/history/[version]/route");

const ORIGIN = "https://trailnotes.example";
const store = createStore(localBackend(root));
const guide = async (slug = "strawberry-peak") => (await store.read(slug))!;

function request(method: string, url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}${url}`, {
    method,
    headers: { origin: ORIGIN, host: "trailnotes.example", "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const put = (slug: string, body: unknown, headers?: Record<string, string>) => PUT(request("PUT", `/api/editor/${slug}`, body, headers), { params: Promise.resolve({ slug }) });
const post = (body: unknown, headers?: Record<string, string>) => POST(request("POST", "/api/editor", body, headers));
const del = (slug: string, body: unknown, headers?: Record<string, string>) => DELETE(request("DELETE", `/api/editor/${slug}`, body, headers), { params: Promise.resolve({ slug }) });

beforeEach(() => {
  state.editor = OWNER;
  state.revalidated = [];
});

describe("PUT /api/editor/[slug]", () => {
  it("is a 404 for anyone who isn't an editor, whatever else is wrong with the request", async () => {
    const g = await guide();
    for (const who of [null, { id: "x", name: "X", role: "viewer" }]) {
      state.editor = who;
      expect((await put("strawberry-peak", { mdx: g.mdx, waypoints: g.waypoints, baseVersion: g.version }, { origin: "https://evil.example" })).status).toBe(404);
    }
    expect((await getOne()).status).toBe(404);
    expect((await getAll()).status).toBe(404);
  });

  it("refuses a request that doesn't come from the site's own pages", async () => {
    const g = await guide();
    const body = { mdx: g.mdx, waypoints: g.waypoints, baseVersion: g.version };
    expect((await put("strawberry-peak", body, { origin: "https://evil.example" })).status).toBe(403);
    expect((await put("strawberry-peak", body, { origin: "null" })).status).toBe(403);
  });

  it("answers bad addresses and unknown hikes with a 404, and malformed bodies with a 400", async () => {
    const g = await guide();
    const body = { mdx: g.mdx, waypoints: g.waypoints, baseVersion: g.version };
    expect((await put("../etc", body)).status).toBe(404);
    expect((await put("no-such-hike", body)).status).toBe(404);
    for (const bad of ["{ not json", "null", "[]", { mdx: g.mdx }, { ...body, baseVersion: 3 }]) expect((await put("strawberry-peak", bad)).status).toBe(400);
  });

  it("saves a valid change once to the working copy, and refuses the same version twice", async () => {
    const g = await guide();
    const body = { mdx: g.mdx.replace("7.3 miles", "7.4 miles"), waypoints: g.waypoints, baseVersion: g.version };
    const ok = await put("strawberry-peak", body);
    expect(ok.status).toBe(200);
    // The public pages show the published copy, which a save doesn't change.
    expect(state.revalidated).toEqual([]);
    expect((await guide()).mdx).toContain("7.4 miles");
    expect((await guide()).published?.mdx).toContain("7.3 miles");
    const stale = await put("strawberry-peak", { ...body, mdx: g.mdx });
    expect(stale.status).toBe(409);
    expect((await guide()).mdx).toContain("7.4 miles");
  });

  it("writes nothing when the guide carries code", async () => {
    const g = await guide("ridgeline-loop");
    const res = await put("ridgeline-loop", { mdx: `${g.mdx}\n\nHello {/* x */ globalThis.__pwned = 1 /* y */}\n`, waypoints: g.waypoints, baseVersion: g.version });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { problems: string[] }).problems.join("\n")).toMatch(/can't contain \{…\} expressions/);
    expect((await guide("ridgeline-loop")).mdx).toBe(g.mdx);
  });

  it("refuses a body that is too large, with or without a length header", async () => {
    const g = await guide();
    const big = { mdx: "x".repeat(800_000), waypoints: g.waypoints, baseVersion: g.version };
    expect((await put("strawberry-peak", big)).status).toBe(413);
    expect((await put("strawberry-peak", big, { "content-length": "900000" })).status).toBe(413);
  });
});

describe("POST /api/editor", () => {
  const draft = async (slug: string) => {
    const g = await guide();
    return { slug, mdx: g.mdx.replace("slug: strawberry-peak", `slug: ${slug}`), waypoints: g.waypoints };
  };

  it("creates a hike, keeping only the track's own fields", async () => {
    const g = await guide();
    const res = await post({ ...(await draft("zz-created")), track: { ...g.track, times: ["2026-04-19T14:00:00Z"] } });
    expect(res.status).toBe(201);
    expect(readFileSync(path.join(root, "zz-created", "track.json"), "utf8")).not.toMatch(/times|2026-04-19T/);
    expect((await post(await draft("zz-created"))).status).toBe(409);
  });

  it("refuses addresses that aren't one, or that the app uses itself", async () => {
    for (const slug of ["new", "../x", "a\nb", "Has Caps", 3]) {
      expect((await post({ ...(await draft("zz-x")), slug })).status).toBe(400);
    }
    expect(existsSync(path.join(root, "new"))).toBe(false);
  });

  it("refuses a track that isn't a track", async () => {
    const res = await post({ ...(await draft("zz-bad-track")), track: { points: [[999, 999, 1e308], [0, 0, 0]], distanceMi: 1, elevationGainFt: 0, maxElevationFt: 0, minElevationFt: 0 } });
    expect(res.status).toBe(422);
    expect(existsSync(path.join(root, "zz-bad-track"))).toBe(false);
  });

  it("is a 404 for anyone who isn't an editor", async () => {
    state.editor = null;
    expect((await post(await draft("zz-nobody"))).status).toBe(404);
  });
});

describe("DELETE /api/editor/[slug]", () => {
  // ridgeline-loop is a draft in content/hikes; strawberry-peak is published.
  it("is a 404 for anyone who isn't an editor, and a 403 from another site", async () => {
    const g = await guide("ridgeline-loop");
    state.editor = null;
    expect((await del("ridgeline-loop", { baseVersion: g.version })).status).toBe(404);
    state.editor = OWNER;
    expect((await del("ridgeline-loop", { baseVersion: g.version }, { origin: "https://evil.example" })).status).toBe(403);
    expect((await del("../etc", { baseVersion: g.version })).status).toBe(404);
    expect((await del("no-such-hike", { baseVersion: "x" })).status).toBe(404);
    for (const bad of ["{ not json", "null", {}, { baseVersion: 3 }]) expect((await del("ridgeline-loop", bad)).status).toBe(400);
    expect(await store.read("ridgeline-loop")).not.toBeNull();
  });

  it("refuses a published guide and a stale version", async () => {
    const published = await guide();
    const res = await del("strawberry-peak", { baseVersion: published.version });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ problems: [expect.stringMatching(/Unpublish it first/)] });
    expect(await store.read("strawberry-peak")).not.toBeNull();
    expect(await (await del("ridgeline-loop", { baseVersion: "stale" })).json()).toMatchObject({ conflict: true });
  });

  it("deletes a draft at the version last seen", async () => {
    const g = await guide("ridgeline-loop");
    expect((await del("ridgeline-loop", { baseVersion: g.version })).status).toBe(200);
    expect(await store.read("ridgeline-loop")).toBeNull();
    expect(state.revalidated).toEqual(["/", "/hikes"]);
  });
});

describe("GET /api/editor/[slug]/history and /history/[version]", () => {
  const history = (slug: string) => getHistory(new Request(`${ORIGIN}/api/editor/${slug}/history`), { params: Promise.resolve({ slug }) });
  const revision = (slug: string, version: string) => getRevision(new Request(`${ORIGIN}/api/editor/${slug}/history/${version}`), { params: Promise.resolve({ slug, version }) });

  it("is a 404 for anyone who isn't an editor", async () => {
    for (const who of [null, { id: "x", name: "X", role: "viewer" }]) {
      state.editor = who;
      expect((await history("strawberry-peak")).status).toBe(404);
      expect((await revision("strawberry-peak", "1")).status).toBe(404);
    }
  });

  it("answers bad addresses with a 404", async () => {
    expect((await history("../etc")).status).toBe(404);
    for (const v of ["x", "-1", "1e3", "1234567890"]) expect((await revision("strawberry-peak", v)).status).toBe(404);
  });

  it("lists nothing for guides in files, which keep no history (git does)", async () => {
    const res = await history("strawberry-peak");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ revisions: [], kept: false });
    expect((await revision("strawberry-peak", "1")).status).toBe(404);
  });
});

describe("POST / DELETE /api/editor/[slug]/publish", () => {
  const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });
  const publish = (slug: string, body: unknown, headers?: Record<string, string>) => publishRoute(request("POST", `/api/editor/${slug}/publish`, body, headers), ctx(slug));
  const unpublish = (slug: string, body: unknown, headers?: Record<string, string>) => unpublishRoute(request("DELETE", `/api/editor/${slug}/publish`, body, headers), ctx(slug));

  it("is a 404 for anyone who isn't an editor, and a 403 from another site", async () => {
    const g = await guide();
    state.editor = null;
    expect((await publish("strawberry-peak", { baseVersion: g.version })).status).toBe(404);
    expect((await unpublish("strawberry-peak", { baseVersion: g.version })).status).toBe(404);
    expect((await getPublish()).status).toBe(404);
    state.editor = OWNER;
    expect((await publish("strawberry-peak", { baseVersion: g.version }, { origin: "https://evil.example" })).status).toBe(403);
    for (const bad of ["{ not json", {}, { baseVersion: 1 }]) expect((await publish("strawberry-peak", bad)).status).toBe(400);
    expect((await publish("no-such-hike", { baseVersion: "x" })).status).toBe(404);
    expect(state.revalidated).toEqual([]);
  });

  it("publishes the working copy, refreshes the pages, and refuses a stale version", async () => {
    const g = await guide();
    expect((await publish("strawberry-peak", { baseVersion: "stale" })).status).toBe(409);
    const res = await publish("strawberry-peak", { baseVersion: g.version });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, status: "published" });
    expect(state.revalidated).toEqual(["/hikes/strawberry-peak", "/", "/hikes"]);
    expect((await guide()).published?.mdx).toBe(g.mdx);
  });

  it("unpublishes, keeping the working copy", async () => {
    const g = await guide("strawberry-peak");
    const res = await unpublish("strawberry-peak", { baseVersion: g.version });
    expect(res.status).toBe(200);
    const after = await guide("strawberry-peak");
    expect(after).toMatchObject({ status: "draft", published: null, mdx: g.mdx });
    expect(state.revalidated).toEqual(["/hikes/strawberry-peak", "/", "/hikes"]);
  });
});
