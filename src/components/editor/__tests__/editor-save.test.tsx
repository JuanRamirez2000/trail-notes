// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Editor } from "../Editor";

// The views aren't what's under test: the shell's save loop is.
vi.mock("next/dynamic", () => ({ default: () => () => null }));
// The delete section at the end of Details navigates away once a hike is deleted.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }));
vi.mock("next/link", () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock("../AdvancedView", () => ({ AdvancedView: () => null }));
vi.mock("../pins/PinsView", () => ({ PinsView: () => null }));

const MDX = readFileSync("fixtures/hikes/cedar-ridge/index.mdx", "utf8");
const PINS = readFileSync("fixtures/hikes/cedar-ridge/waypoints.json", "utf8");

type Sent = { url: string; method: string; body: { mdx: string; baseVersion: string }; answer: (status: number, data: unknown) => void };
let sent: Sent[];

beforeEach(() => {
  vi.useFakeTimers();
  sent = [];
  vi.stubGlobal("fetch", (url: string, init: { method: string; body: string }) =>
    new Promise((resolve) => sent.push({ url, method: init.method, body: JSON.parse(init.body), answer: (status, data) => resolve(new Response(JSON.stringify(data), { status })) })),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const PUBLISHED = { mdx: MDX, waypoints: PINS };
const open = (published: typeof PUBLISHED | null = PUBLISHED) =>
  render(<Editor slug="cedar-ridge" initialMdx={MDX} initialWaypoints={PINS} initialVersion="1" initialPublished={published} track={null} editorName="Owner" canSignOut={false} />);
const click = (name: string) => act(async () => void fireEvent.click(screen.getByRole("button", { name })));
/** An edit, made the way an author would: the title in the Details form. */
const retitle = async (title: string) => {
  await act(async () => void fireEvent.click(screen.getByRole("tab", { name: "Details" })));
  await act(async () => void fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: title } }));
};
const wait = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const answer = (i: number, status: number, data: unknown) => act(async () => void sent[i].answer(status, data));

describe("the editor's save loop", () => {
  it("sends one save at a time, and bases the next on the version the first returned", async () => {
    open();
    await retitle("Cedar Ridge A");
    await wait(1600);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ method: "PUT", body: { baseVersion: "1" } });
    expect(sent[0].body.mdx).toMatch(/^title: Cedar Ridge A$/m);

    // A second change, and its autosave, while the first save is still on its way.
    await retitle("Cedar Ridge B");
    await wait(1600);
    expect(sent).toHaveLength(1);

    await answer(0, 200, { ok: true, version: "2" });
    expect(sent).toHaveLength(2);
    expect(sent[1].body).toMatchObject({ baseVersion: "2" });
    expect(sent[1].body.mdx).toMatch(/^title: Cedar Ridge B$/m);

    await answer(1, 200, { ok: true, version: "3" });
    expect(screen.queryByText(/changed since you opened it/)).toBeNull();
    expect(screen.getByText(/^Saved /)).toBeTruthy();
    await wait(5000);
    expect(sent).toHaveLength(2);
  });

  it("stops at a real conflict and doesn't retry", async () => {
    open();
    await retitle("Cedar Ridge A");
    await wait(1600);
    await retitle("Cedar Ridge B");
    await wait(1600);
    await answer(0, 409, { ok: false, conflict: true, version: "9" });
    expect(screen.getByText(/changed since you opened it/)).toBeTruthy();
    await wait(5000);
    expect(sent).toHaveLength(1);
  });

  it("asks before leaving with unsaved text, and not once it's saved", async () => {
    const leave = () => {
      const e = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    };
    open();
    expect(leave()).toBe(false);
    await retitle("Cedar Ridge A");
    expect(leave()).toBe(true);
    await wait(1600);
    expect(leave()).toBe(true);
    await answer(0, 200, { ok: true, version: "2" });
    expect(leave()).toBe(false);
  });
});

describe("publishing from the editor", () => {
  it("shows changes as not live, and publishes them only once they're saved, at the saved version", async () => {
    open();
    expect(screen.getByText("Published")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Publish changes" })).toBeNull();

    await retitle("Cedar Ridge A");
    expect(screen.getByText("Published · changes not live")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Publish changes" }) as HTMLButtonElement).disabled).toBe(true);

    await wait(1600);
    await answer(0, 200, { ok: true, version: "2" });
    await click("Publish changes");
    expect(sent[1]).toMatchObject({ url: "/api/editor/cedar-ridge/publish", method: "POST", body: { baseVersion: "2" } });
    await answer(1, 200, { ok: true, status: "published" });
    expect(screen.getByText("Published")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Publish changes" })).toBeNull();
  });

  it("asks before unpublishing, and sends nothing if the answer is no", async () => {
    open();
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    await click("Unpublish");
    expect(confirm).toHaveBeenCalledOnce();
    expect(sent).toHaveLength(0);

    confirm.mockReturnValue(true);
    await click("Unpublish");
    expect(sent[0]).toMatchObject({ url: "/api/editor/cedar-ridge/publish", method: "DELETE", body: { baseVersion: "1" } });
    await answer(0, 200, { ok: true, status: "draft" });
    expect(screen.getByText("Draft")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publish" })).toBeTruthy();
  });

  it("shows a refused publish, and a stale version as a conflict", async () => {
    open(null);
    await click("Publish");
    await answer(0, 422, { ok: false, problems: ["index.mdx: something is wrong"] });
    expect(screen.getByRole("alert").textContent).toMatch(/something is wrong/);
    expect(screen.getByText("Draft")).toBeTruthy();
    await click("Publish");
    await answer(1, 409, { ok: false, conflict: true, version: "7" });
    expect(screen.getByText(/changed since you opened it/)).toBeTruthy();
  });
});
