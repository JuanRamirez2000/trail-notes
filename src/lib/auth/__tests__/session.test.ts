import { beforeEach, describe, expect, it, vi } from "vitest";
import { safeNext, SESSION_HINT } from "../session-hint";

const state = vi.hoisted(() => ({ editor: null as unknown, mode: "supabase" }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ getEditor: async () => state.editor, authMode: () => state.mode }));

const { GET } = await import("@/app/api/session/route");
const ask = async (query = "") => {
  const res = await GET(new Request(`https://trailnotes.example/api/session${query}`));
  return { body: await res.json(), res };
};

beforeEach(() => {
  state.editor = null;
  state.mode = "supabase";
});

describe("safeNext", () => {
  it("lets a page of this site through", () => {
    for (const ok of ["/", "/hikes", "/hikes/cedar-ridge", "/editor/a-b_c"]) expect(safeNext(ok)).toBe(ok);
  });

  it("refuses anything that could leave the site, or isn't a path", () => {
    for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", "hikes", "/a?next=//x", "/a b", "", null, undefined, 7, "/" + "a".repeat(300)]) {
      expect(safeNext(bad), String(bad).slice(0, 30)).toBeNull();
    }
  });
});

describe("GET /api/session", () => {
  it("says nobody to a visitor, tells them nothing more, and drops the sign-in hint", async () => {
    const { body, res } = await ask("?slug=cedar-ridge");
    expect(body).toEqual({ editor: null, canEdit: false, canSignOut: true });
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("set-cookie")).toContain(`${SESSION_HINT}=;`);
  });

  it("treats a signed-in person who isn't an editor as a visitor", async () => {
    state.editor = { id: "x", name: "X", role: "viewer" };
    expect((await ask("?slug=cedar-ridge")).body).toMatchObject({ editor: null, canEdit: false });
  });

  it("gives an editor their name and role, and whether they may edit the hike asked about", async () => {
    state.editor = { id: "o", name: "Owner", email: "owner@example.test", role: "owner" };
    const { body, res } = await ask("?slug=cedar-ridge");
    expect(body).toEqual({ editor: { name: "Owner", role: "owner" }, canEdit: true, canSignOut: true });
    expect(res.headers.get("set-cookie")).toBeNull();
    expect((await ask()).body.canEdit).toBe(false);
    expect((await ask("?slug=../etc")).body.canEdit).toBe(false);
  });

  it("offers no sign out where there's no sign-in (the local owner under pnpm dev)", async () => {
    state.editor = { id: "local", name: "Local owner", role: "owner" };
    state.mode = "local";
    expect((await ask()).body).toMatchObject({ editor: { name: "Local owner" }, canSignOut: false });
  });
});
