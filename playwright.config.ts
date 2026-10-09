import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests (`pnpm e2e`, after `pnpm build`). Two servers, both on the guides in
 * `content/hikes` and never the database, whatever `.env.local` says:
 *
 *  - `next start` on 3211: the site as a visitor gets it. With `EDITOR_AUTH` unset a production
 *    server has no editors, so everyone is an outsider (e2e/outsider.spec.ts).
 *  - `next dev` on 3210: under dev the editor is a local owner with no sign-in, which is the only
 *    way to reach the editor without a real Google account (e2e/editor.spec.ts). Next allows one
 *    `next dev` per folder, so stop `pnpm dev` first.
 *
 * The editor tests work on a hike they create (`zz-e2e-…`) and delete, and keep its photos in
 * `public/photos` (the dev server runs with `NEXT_PUBLIC_PHOTO_STORAGE=local`).
 */
const SITE = "http://127.0.0.1:3211";
const EDITOR = "http://127.0.0.1:3210";
const env = { CONTENT_STORE: "local", EDITOR_AUTH: "", NEXT_TELEMETRY_DISABLED: "1" };
// The editor tests upload photos: onto this machine's disk (public/photos), never to the bucket.
const editorEnv = { ...env, NEXT_PUBLIC_PHOTO_STORAGE: "local" };

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // The editor tests share one hike and one dev server.
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: { ...devices["Desktop Chrome"], trace: "retain-on-failure" },
  projects: [
    { name: "outsider", testMatch: "outsider.spec.ts", use: { baseURL: SITE } },
    { name: "editor", testMatch: "editor.spec.ts", use: { baseURL: EDITOR } },
  ],
  webServer: [
    { command: "pnpm exec next start --port 3211 --hostname 127.0.0.1", url: `${SITE}/api/health`, env, reuseExistingServer: false, timeout: 60_000 },
    { command: "pnpm exec next dev --port 3210 --hostname 127.0.0.1", url: `${EDITOR}/api/health`, env: editorEnv, reuseExistingServer: false, timeout: 120_000 },
  ],
});
