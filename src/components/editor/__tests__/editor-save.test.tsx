// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Editor } from "../Editor";

// The views aren't what's under test: the shell's save loop is.
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("next/link", () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock("../AdvancedView", () => ({ AdvancedView: () => null }));
vi.mock("../pins/PinsView", () => ({ PinsView: () => null }));

const MDX = readFileSync("content/hikes/strawberry-peak/index.mdx", "utf8");
const PINS = readFileSync("content/hikes/strawberry-peak/waypoints.json", "utf8");

type Sent = { body: { mdx: string; baseVersion: string }; answer: (status: number, data: unknown) => void };
let sent: Sent[];

beforeEach(() => {
  vi.useFakeTimers();
  sent = [];
  vi.stubGlobal("fetch", (_url: string, init: { body: string }) =>
    new Promise((resolve) => sent.push({ body: JSON.parse(init.body), answer: (status, data) => resolve(new Response(JSON.stringify(data), { status })) })),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const open = (mdx = MDX) => render(<Editor slug="strawberry-peak" initialMdx={mdx} initialWaypoints={PINS} initialVersion="1" track={null} editorName="Owner" canSignOut={false} />);
const click = (name: string) => act(async () => void fireEvent.click(screen.getByRole("button", { name })));
const wait = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const answer = (i: number, status: number, data: unknown) => act(async () => void sent[i].answer(status, data));

describe("the editor's save loop", () => {
  it("sends one save at a time, and bases the next on the version the first returned", async () => {
    open();
    await click("Unpublish");
    await wait(1600);
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toMatchObject({ baseVersion: "1" });
    expect(sent[0].body.mdx).toMatch(/^draft: true$/m);

    // A second change, and its autosave, while the first save is still on its way.
    await click("Publish");
    await wait(1600);
    expect(sent).toHaveLength(1);

    await answer(0, 200, { ok: true, version: "2" });
    expect(sent).toHaveLength(2);
    expect(sent[1].body).toMatchObject({ baseVersion: "2" });
    expect(sent[1].body.mdx).not.toMatch(/^draft: true$/m);

    await answer(1, 200, { ok: true, version: "3" });
    expect(screen.queryByText(/changed since you opened it/)).toBeNull();
    expect(screen.getByText(/^Saved /)).toBeTruthy();
    await wait(5000);
    expect(sent).toHaveLength(2);
  });

  it("stops at a real conflict and doesn't retry", async () => {
    open();
    await click("Unpublish");
    await wait(1600);
    await click("Publish");
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
    await click("Unpublish");
    expect(leave()).toBe(true);
    await wait(1600);
    expect(leave()).toBe(true);
    await answer(0, 200, { ok: true, version: "2" });
    expect(leave()).toBe(false);
  });

  it("says why it can't change the draft flag when the guide's details aren't valid YAML", async () => {
    // With unreadable details the guide shows as published, so the button offered is Unpublish.
    open(MDX.replace(/^title: .*$/m, "title: A: B"));
    await click("Unpublish");
    expect(screen.getByRole("alert").textContent).toMatch(/Can't unpublish yet/);
    await wait(3000);
    expect(sent).toHaveLength(0);
  });
});
