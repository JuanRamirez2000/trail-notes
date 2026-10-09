import path from "node:path";

/** Where the end-to-end run keeps its copy of the fixture guides (scripts/e2e.ts makes it). */
export const E2E_HIKES = path.resolve(".e2e/hikes");

/**
 * What the build and both servers of an end-to-end run are given: guides from that folder, photos
 * from public/photos, and nobody signed in. Nothing in it can reach the database or the bucket.
 * E2E_BUILD lets a production build use photos on disk (next.config.ts refuses that otherwise).
 */
export const E2E_ENV = {
  CONTENT_STORE: "local",
  CONTENT_DIR: E2E_HIKES,
  EDITOR_AUTH: "",
  NEXT_PUBLIC_PHOTO_STORAGE: "local",
  E2E_BUILD: "1",
  NEXT_TELEMETRY_DISABLED: "1",
};
