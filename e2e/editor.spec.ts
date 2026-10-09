import { existsSync } from "node:fs";
import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * The editor as its (local) owner, on a hike made for the run: create, save, a conflicting tab,
 * publish, unpublish, delete. Serial: each step continues from the one before.
 */
test.describe.configure({ mode: "serial" });

const slug = `zz-e2e-${Date.now().toString(36)}`;
const title = `E2E ${slug}`;
const HIKES = path.join(process.cwd(), "content/hikes");
const PHOTOS = path.join(process.cwd(), "public/photos");
const SAMPLES = path.join(process.cwd(), "fixtures/sample-photos/ridgeline-loop");
/** A 1 × 1 PNG: a picture with no EXIF, so no position. */
const NO_GPS = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const sample = async (name: string) => ({ name, mimeType: "image/jpeg", buffer: await readFile(path.join(SAMPLES, name)) });
const stored = async () => (existsSync(path.join(PHOTOS, slug)) ? (await readdir(path.join(PHOTOS, slug))).sort() : []);

const status = (page: Page) => page.getByTestId("save-status");
const badge = (page: Page) => page.getByTestId("publish-badge");
const summary = (page: Page) => page.locator("#summary");

async function openDetails(page: Page) {
  await page.goto(`/editor/${slug}`);
  await page.getByRole("tab", { name: "Details" }).click();
  await expect(summary(page)).toBeVisible();
}

test.beforeAll(async ({ request }) => {
  // These tests write guides: only ever to files.
  expect((await (await request.get("/api/health")).json()).store).toBe("local");
});

test.afterAll(async () => {
  // Whatever a failed run left behind.
  for (const dir of await readdir(HIKES)) if (dir.startsWith("zz-e2e-")) await rm(path.join(HIKES, dir), { recursive: true, force: true });
  if (existsSync(PHOTOS)) for (const dir of await readdir(PHOTOS)) if (dir.startsWith("zz-e2e-")) await rm(path.join(PHOTOS, dir), { recursive: true, force: true });
});

test("create a draft from the New hike form", async ({ page }) => {
  await page.goto("/editor/new");
  await page.getByLabel("Title").fill(title);
  await expect(page.getByLabel("Address")).toHaveValue(`e2e-${slug}`);
  await page.getByLabel("Address").fill(slug);
  await page.getByLabel("Region").fill("Test Range");
  await page.getByLabel("Summary").fill("A hike that exists for one test run.");
  await page.getByLabel("Date hiked").fill("2026-04-19");
  await page.getByLabel("Distance (mi)").fill("3.2");
  await page.getByLabel("Elevation gain (ft)").fill("600");
  await page.getByLabel("Trailhead latitude").fill("34.2591");
  await page.getByLabel("Trailhead longitude").fill("-118.1041");
  await page.getByRole("button", { name: "Create draft" }).click();

  await expect(page).toHaveURL(new RegExp(`/editor/${slug}$`));
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(badge(page)).toHaveText("Draft");
});

test("an edit is saved and survives a reload", async ({ page }) => {
  await openDetails(page);
  await summary(page).fill("Saved by the first tab.");
  await expect(status(page)).toHaveText(/^Saved /);
  await page.reload();
  await page.getByRole("tab", { name: "Details" }).click();
  await expect(summary(page)).toHaveValue("Saved by the first tab.");
});

test("a second tab with an older copy gets the conflict banner and saves nothing", async ({ page, context }) => {
  await openDetails(page);
  const stale = await context.newPage();
  await openDetails(stale);

  await summary(page).fill("The first tab got there first.");
  await expect(status(page)).toHaveText(/^Saved /);

  await summary(stale).fill("The stale tab tries to overwrite it.");
  await expect(stale.getByRole("alert").filter({ hasText: "not saved" })).toBeVisible();
  await expect(status(stale)).toHaveText("Not saved: this guide changed elsewhere");

  await page.reload();
  await page.getByRole("tab", { name: "Details" }).click();
  await expect(summary(page)).toHaveValue("The first tab got there first.");
});

test("publish, edit, publish the changes, unpublish", async ({ page }) => {
  await openDetails(page);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(badge(page)).toHaveText("Published");

  // A save changes the working copy only.
  await summary(page).fill("Edited after publishing.");
  await expect(status(page)).toHaveText(/^Saved /);
  await expect(badge(page)).toHaveText("Published · changes not live");

  await page.getByRole("button", { name: "Publish changes" }).click();
  await expect(badge(page)).toHaveText("Published");

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Unpublish" }).click();
  await expect(badge(page)).toHaveText("Draft");
});

test("photos dropped into Pins are resized, uploaded and pinned; an unplaced one can be deleted", async ({ page }) => {
  // These uploads must land on this machine's disk.
  expect((await (await page.request.get("/api/health")).json()).store).toBe("local");
  await page.goto(`/editor/${slug}`);
  await page.getByRole("tab", { name: "Pins" }).click();
  const pinList = page.getByRole("list", { name: "Pins in route order" });
  const before = await pinList.getByRole("listitem").count();

  await page.getByLabel("Add photos").setInputFiles([
    await sample("IMG_2041.jpg"),
    await sample("IMG_2047.jpg"),
    { name: "No GPS.png", mimeType: "image/png", buffer: NO_GPS },
  ]);
  const uploads = page.getByRole("list", { name: "Uploads" });
  await expect(uploads.locator('[data-upload="pinned"]')).toHaveCount(2);
  await expect(uploads.locator('[data-upload="unplaced"]')).toHaveCount(1);

  // Two pins, numbered by the server, each with its two webp files; the third photo is stored but on no pin.
  await expect(pinList.getByRole("listitem")).toHaveCount(before + 2);
  await expect(pinList.getByText("Photo 02")).toBeVisible();
  expect(await stored()).toEqual(["01-img-2041", "02-img-2047", "03-no-gps"].flatMap((n) => [`${n}.full.webp`, `${n}.thumb.webp`]));
  expect((await page.request.get(`/photos/${slug}/01-img-2041.thumb.webp`)).headers()["content-type"]).toBe("image/webp");
  await expect(status(page)).toHaveText(/^Saved /);

  // The same file again is recognised, not uploaded twice.
  await page.getByLabel("Add photos").setInputFiles([await sample("IMG_2041.jpg")]);
  await expect(uploads.locator('[data-upload="skipped"]')).toHaveCount(1);

  // A photo on a pin can't be deleted; the unplaced one can.
  const del = (key: string) => page.request.delete(`/api/editor/${slug}/photos`, { data: { key }, headers: { origin: new URL(page.url()).origin } });
  expect((await del(`${slug}/01-img-2041`)).status()).toBe(409);
  const tray = page.getByRole("list", { name: "Unplaced photos" });
  await expect(tray.getByRole("listitem")).toHaveCount(1);
  page.once("dialog", (d) => d.accept());
  await tray.getByRole("button", { name: "Delete 03-no-gps" }).click();
  await expect(tray).toHaveCount(0);
  expect(await stored()).toHaveLength(4);

  // The pins survive a reload, with their photos.
  await page.reload();
  await page.getByRole("tab", { name: "Pins" }).click();
  await expect(page.getByRole("list", { name: "Pins in route order" }).getByText("Photo 01")).toBeVisible();
});

test("delete the draft", async ({ page }) => {
  await openDetails(page);
  await page.getByRole("button", { name: "Delete draft…" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.getByText(title)).toHaveCount(0);
  expect((await page.request.get(`/editor/${slug}`)).status()).toBe(404);
  // Its photos went with it.
  expect(await stored()).toEqual([]);
});
