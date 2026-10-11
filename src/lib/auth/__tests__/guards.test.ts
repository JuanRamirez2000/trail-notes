import { describe, expect, it } from "vitest";
import type { Editor } from "../../store/types";
import { can } from "../can";
import { rateLimiter, sameOrigin } from "../request";

const req = (headers: Record<string, string>, url = "https://trailnotes.example/api/editor/x") => new Request(url, { method: "PUT", headers });

describe("sameOrigin", () => {
  it("accepts a request from the site's own pages", () => {
    expect(sameOrigin(req({ origin: "https://trailnotes.example", host: "trailnotes.example" }))).toBe(true);
  });
  it("uses the forwarded host behind a proxy (Vercel)", () => {
    expect(sameOrigin(req({ origin: "https://trailnotes.example", host: "internal:3000", "x-forwarded-host": "trailnotes.example" }))).toBe(true);
  });
  it.each([
    ["another site", { origin: "https://evil.example", host: "trailnotes.example" }],
    ["a lookalike subdomain", { origin: "https://trailnotes.example.evil.example", host: "trailnotes.example" }],
    ["no Origin at all (curl, scripts)", { host: "trailnotes.example" }],
    ["a malformed Origin", { origin: "null", host: "trailnotes.example" }],
  ])("refuses %s", (_what, headers) => {
    expect(sameOrigin(req(headers as Record<string, string>))).toBe(false);
  });
});

describe("rateLimiter", () => {
  it("allows up to the limit per key per window, then again in the next window", () => {
    const allow = rateLimiter({ limit: 3, windowMs: 1000 });
    expect([1, 2, 3, 4].map(() => allow("a", 0))).toEqual([true, true, true, false]);
    expect(allow("b", 0)).toBe(true); // another editor isn't affected
    expect(allow("a", 1000)).toBe(true);
  });
});

describe("can", () => {
  const owner: Editor = { id: "1", name: "O", role: "owner" };
  it("refuses nobody for everything", () => {
    for (const action of ["list", "read", "save", "create"] as const) expect(can(null, action, "x")).toBe(false);
  });
  it("lets an editor on the list act", () => {
    expect(can(owner, "save", "cedar-ridge")).toBe(true);
    expect(can({ ...owner, role: "editor" }, "save", "cedar-ridge")).toBe(true);
  });
  describe("a guest", () => {
    const guest: Editor = { id: "2", name: "G", role: "guest", hikes: ["their-hike"] };
    const onAHike = ["read", "save", "photos", "publish", "delete"] as const;

    it("may see the hike list and start a hike", () => {
      expect(can(guest, "list")).toBe(true);
      expect(can(guest, "create")).toBe(true);
    });
    it("may do everything to their own hikes", () => {
      for (const action of onAHike) expect(can(guest, action, "their-hike"), action).toBe(true);
    });
    it("may do nothing to anyone else's", () => {
      for (const action of onAHike) expect(can(guest, action, "cedar-ridge"), action).toBe(false);
    });
    it("is refused when no hike is named, or when they have none", () => {
      for (const action of onAHike) expect(can(guest, action), action).toBe(false);
      expect(can({ ...guest, hikes: undefined }, "save", "their-hike")).toBe(false);
      expect(can({ ...guest, hikes: [] }, "read", "their-hike")).toBe(false);
    });
  });
  it("refuses a role it doesn't know", () => {
    expect(can({ ...owner, role: "viewer" as never }, "save", "x")).toBe(false);
  });
});
