import { readdir, rm } from "node:fs/promises";
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

test("delete the draft", async ({ page }) => {
  await openDetails(page);
  await page.getByRole("button", { name: "Delete draft…" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.getByText(title)).toHaveCount(0);
  expect((await page.request.get(`/editor/${slug}`)).status()).toBe(404);
});
