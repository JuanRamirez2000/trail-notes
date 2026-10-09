import { expect, test } from "@playwright/test";

/** A production server with no sign-in configured: nobody is an editor. */

test("the gallery and a published guide are public", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Find a hike" })).toBeVisible();
  await page.getByRole("link", { name: /Strawberry Peak/ }).first().click();
  await expect(page).toHaveURL(/\/hikes\/strawberry-peak$/);
  await expect(page.getByRole("heading", { level: 1, name: "Strawberry Peak" })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Elevation along the route/ })).toBeVisible();
});

test("a draft has no page and isn't listed", async ({ page, request }) => {
  expect((await request.get("/hikes/granite-saddle")).status()).toBe(404);
  await page.goto("/");
  await expect(page.getByText("Granite Saddle")).toHaveCount(0);
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain("granite-saddle");
});

test("the editor's pages are a 404", async ({ page }) => {
  for (const path of ["/editor", "/editor/new", "/editor/strawberry-peak"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
    await expect(page.getByRole("heading", { name: "You've wandered off the trail" })).toBeVisible();
  }
});

test("the editor's API is a 404 for every method", async ({ request, baseURL }) => {
  // Same origin, as the editor itself would send it, so the 404 is the editor check and not the origin check.
  const headers = { origin: baseURL!, "content-type": "application/json" };
  const body = { mdx: "", waypoints: "", baseVersion: "1" };
  const calls: [string, string][] = [
    ["POST", "/api/editor"],
    ["GET", "/api/editor/strawberry-peak"],
    ["PUT", "/api/editor/strawberry-peak"],
    ["DELETE", "/api/editor/strawberry-peak"],
    ["POST", "/api/editor/strawberry-peak/publish"],
    ["DELETE", "/api/editor/strawberry-peak/publish"],
    ["GET", "/api/editor/strawberry-peak/history"],
    ["GET", "/api/editor/strawberry-peak/history/1"],
  ];
  for (const [method, path] of calls) {
    const res = await request.fetch(path, { method, headers, data: method === "GET" ? undefined : body });
    expect(res.status(), `${method} ${path}`).toBe(404);
  }
});

test("health reports published guides only", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true, store: "local", published: 1 });
});
