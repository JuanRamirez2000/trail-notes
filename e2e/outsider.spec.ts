import { expect, test } from "@playwright/test";

/** A production server with no sign-in configured: nobody is an editor. */

test("the landing page leads to the gallery and a published guide", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Every turn, pin and view in one guide." })).toBeVisible();
  // The preview is the published guide, live: its steps are there to pick.
  await expect(page.getByRole("list", { name: "First steps of the guide" }).getByRole("button")).toHaveCount(4);
  await page.getByRole("link", { name: "Browse hikes" }).first().click();
  await expect(page).toHaveURL(/\/hikes$/);
  await expect(page.getByRole("heading", { level: 1, name: "Find a hike" })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: /Cedar Ridge/ }).first().click();
  await expect(page).toHaveURL(/\/hikes\/cedar-ridge$/);
  await expect(page.getByRole("heading", { level: 1, name: "Cedar Ridge" })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Elevation along the route/ })).toBeVisible();
});

test("a guide's photos open full size, and stepping through them moves the guide", async ({ page }) => {
  await page.goto("/hikes/cedar-ridge");
  await page.getByRole("button", { name: /^View the photo full size/ }).first().click();
  const dialog = page.getByRole("dialog", { name: "Photo" });
  await expect(dialog.getByText("Photo 1 of 6")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByText("Photo 3 of 6")).toBeVisible();
  await expect(dialog.getByRole("img")).toHaveAttribute("alt", /.+/);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  // The guide is now at the photo that was left open.
  await expect(page.locator("#step-saddle")).toBeInViewport();
});

test("a guide comes with a GPX file, a JPEG card image and structured data", async ({ page, request }) => {
  const gpx = await request.get("/hikes/cedar-ridge/route.gpx");
  expect(gpx.headers()["content-type"]).toContain("application/gpx+xml");
  const xml = await gpx.text();
  expect(xml.match(/<wpt /g)).toHaveLength(6);
  expect(xml).toContain("<trkpt ");
  expect(xml).not.toContain("<time>");

  const card = await request.get("/hikes/cedar-ridge/og.jpg");
  expect(card.headers()["content-type"]).toBe("image/jpeg");
  expect((await card.body()).subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));

  await page.goto("/hikes/cedar-ridge");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/hikes\/cedar-ridge\/og\.jpg$/);
  const data = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(data).toMatchObject({ "@type": "Article", headline: "Cedar Ridge", about: { "@type": "Place" } });
  await expect(page.getByRole("link", { name: "Download the route (GPX)" }).first()).toHaveAttribute("href", "/hikes/cedar-ridge/route.gpx");
  expect(await page.locator("img:not([alt]), img[alt='']").count()).toBe(0);
});

test("a draft has no page and isn't listed", async ({ page, request }) => {
  expect((await request.get("/hikes/granite-saddle")).status()).toBe(404);
  expect((await request.get("/hikes/granite-saddle/route.gpx")).status()).toBe(404);
  expect((await request.get("/hikes/granite-saddle/og.jpg")).status()).toBe(404);
  for (const path of ["/", "/hikes"]) {
    await page.goto(path);
    await expect(page.getByText("Granite Saddle"), path).toHaveCount(0);
  }
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain("granite-saddle");
});

test("the editor's pages are a 404", async ({ page }) => {
  for (const path of ["/editor", "/editor/new", "/editor/cedar-ridge"]) {
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
    ["GET", "/api/editor/cedar-ridge"],
    ["PUT", "/api/editor/cedar-ridge"],
    ["DELETE", "/api/editor/cedar-ridge"],
    ["POST", "/api/editor/cedar-ridge/publish"],
    ["DELETE", "/api/editor/cedar-ridge/publish"],
    ["POST", "/api/editor/cedar-ridge/restore"],
    ["GET", "/api/editor/cedar-ridge/history"],
    ["GET", "/api/editor/cedar-ridge/history/1"],
    ["GET", "/api/editor/cedar-ridge/photos"],
    ["POST", "/api/editor/cedar-ridge/photos"],
    ["DELETE", "/api/editor/cedar-ridge/photos"],
    ["PUT", "/api/editor/cedar-ridge/photos/local/01-x.full.webp"],
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
