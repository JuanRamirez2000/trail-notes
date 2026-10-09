import { expect, test } from "@playwright/test";

/** A production server with no sign-in configured: nobody is an editor. */

test("the landing page leads to the gallery and a published guide", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Know every turn before you get there." })).toBeVisible();
  await page.getByRole("link", { name: "Browse the hikes" }).click();
  await expect(page).toHaveURL(/\/hikes$/);
  await expect(page.getByRole("heading", { level: 1, name: "Find a hike" })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: /Strawberry Peak/ }).first().click();
  await expect(page).toHaveURL(/\/hikes\/strawberry-peak$/);
  await expect(page.getByRole("heading", { level: 1, name: "Strawberry Peak" })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Elevation along the route/ })).toBeVisible();
});

test("a guide's photos open full size, and stepping through them moves the guide", async ({ page }) => {
  await page.goto("/hikes/strawberry-peak");
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
  const gpx = await request.get("/hikes/strawberry-peak/route.gpx");
  expect(gpx.headers()["content-type"]).toContain("application/gpx+xml");
  const xml = await gpx.text();
  expect(xml.match(/<wpt /g)).toHaveLength(6);
  expect(xml).toContain("<trkpt ");
  expect(xml).not.toContain("<time>");

  const card = await request.get("/hikes/strawberry-peak/og.jpg");
  expect(card.headers()["content-type"]).toBe("image/jpeg");
  expect((await card.body()).subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));

  await page.goto("/hikes/strawberry-peak");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/hikes\/strawberry-peak\/og\.jpg$/);
  const data = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(data).toMatchObject({ "@type": "Article", headline: "Strawberry Peak", about: { "@type": "Place" } });
  await expect(page.getByRole("link", { name: "Download the route (GPX)" }).first()).toHaveAttribute("href", "/hikes/strawberry-peak/route.gpx");
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
    ["GET", "/api/editor/strawberry-peak/photos"],
    ["POST", "/api/editor/strawberry-peak/photos"],
    ["DELETE", "/api/editor/strawberry-peak/photos"],
    ["PUT", "/api/editor/strawberry-peak/photos/local/01-x.full.webp"],
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
