/**
 * `pnpm e2e`: the end-to-end tests, on the fixture guides and nothing else.
 *
 *  1. copies fixtures/hikes to .e2e/hikes (the tests edit, publish and delete guides there) and the
 *     fixture photos to public/photos
 *  2. builds the site on those (guides from files, photos from disk), whatever .env.local says
 *  3. runs Playwright, which starts the built site and a dev server on the same folder
 *     (playwright.config.ts)
 *
 * The build it leaves in .next is for these tests only: it reads photos from disk, which a real
 * production build refuses. Run `pnpm build` again before `pnpm start`.
 */
import { spawnSync } from "node:child_process";
import { cpSync, rmSync } from "node:fs";
import { E2E_ENV, E2E_HIKES } from "../e2e/env";

rmSync(E2E_HIKES, { recursive: true, force: true });
cpSync("fixtures/hikes", E2E_HIKES, { recursive: true });
cpSync("fixtures/photos", "public/photos", { recursive: true });

const env = { ...process.env, ...E2E_ENV };
const run = (args: string[]) => {
  const { status } = spawnSync("pnpm", ["exec", ...args], { stdio: "inherit", env });
  if (status !== 0) process.exit(status ?? 1);
};
run(["next", "build"]);
run(["playwright", "test", ...process.argv.slice(2)]);
