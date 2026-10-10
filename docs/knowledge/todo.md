# TODO

Grouped by the version each item belongs to. Move items to [changelog.md](changelog.md) when they ship; put larger unscheduled ideas in [backlog.md](backlog.md).

## Left over from v0.1.0 (owner)

From the audit of 2026-10-06 ([changelog.md](changelog.md)). The code fixes are in; these need the owner or a decision.

- [ ] **Capture times in old copies (owner's call).** The stored pins of the three guides were cleaned on 2026-10-07 (through the store, keeping the stored text), and nothing public carries `takenAt` any more. It is still in:
  - rows of `hike_revisions` saved before then (server-only, never public; 12 of 15 rows on 2026-10-08);
  - the public repo's git history (`content/hikes/*/waypoints.json` before 2026-10-07). Removing it means rewriting history and force-pushing.
- [ ] **Backups live on one Mac.** `pnpm backup` runs daily there since 2026-10-09 ([current.md](current.md)). Photos are left out on purpose (owner, 2026-10-09: "we don't need the photos in the backup"), so the bucket is their only copy. Not covered: the Mac itself (the folder isn't off-site unless it's synced somewhere). It also only runs when the Mac is awake; `backup.log` in the folder shows the last run.
- [ ] **Nothing watches `/api/health`.** It answers 503 when the store can't be read, but only Vercel's daily cron calls it. Point an uptime monitor at it. There is no error reporting or analytics either.
- [ ] **CI doesn't check the stored guides:** the `DATABASE_URL` repository secret isn't set, so that step is skipped (owner adds it in GitHub).
- [ ] **PR preview builds fail:** Vercel's Preview environment has no `DATABASE_URL` (owner adds it). Until then only pushes to `main` build on Vercel.
- [ ] **Photo upload: the checks only the owner can do** (shipped 2026-10-08; everything below needs the owner's sign-in or phone):
  - Migration `0003_storage_editor_policies` is applied (2026-10-08). Once an upload has worked on the live site, `SUPABASE_SERVICE_ROLE_KEY` can be deleted from Vercel: the site doesn't read it. Keep it in `.env.local` for `pnpm photos` and `pnpm ingest --storage supabase`.
  - On the live site, on a throwaway draft: add two or three photos in Pins, see them pinned and their thumbnails load, take one off its pin, delete it from Unplaced, then delete the draft and check its folder is gone from the `hikes` bucket. The policies were checked in SQL, but no signed upload has run against the real bucket yet: if signing or the PUT is refused, the reason is in the per-file message.
  - From an iPhone: Safari can't encode webp, so this is the WASM path on a real device (only forced in Chromium so far). Also note what the iOS photo picker hands over: it may convert HEIC to JPEG and may strip the location ("Options" in the picker), in which case the photos arrive unplaced.
- [ ] **Live checks only the owner can do** (they need the owner's Google sign-in; setup and what's already verified are in [current.md](current.md)):
  - Draft and published copies in the live editor: the badge on Strawberry Peak, an edit shows "Published · changes not live" while the public page stays as it was, Publish changes, Unpublish (the page is a 404 on the very next load), Publish again. Checked locally and by `pnpm e2e` on 2026-10-08, not on the live site.
  - A hike created and published on the live site gets its page without a deploy.
  - Staying signed in: the session refresh (`src/proxy.ts`) has never seen a real token. If it's wrong you're signed out after about an hour while working.
  - Signing in ends on `trail-notes-amber.vercel.app`, not on a deployment's own `*.vercel.app` address.
  - Signed out mid-edit: the next save says you're no longer signed in, and the text stays in the tab.
  - The daily keep-alive is listed under Cron Jobs in Vercel.
  - Untested, and only testable by pausing the Supabase project: cached pages keep being served while the database is unreachable.
- [ ] **Accessibility leftovers** (from the pass of 2026-10-08, none serious):
  - Map pin buttons are named by the pin's label while their visible text starts with the glyph or number (Lighthouse: "visible text labels do not match accessible names"). Hiding the glyph from the name calculation would fix it.
  - Every Mapbox canvas is a landmark called "Map"; a page with several maps has several identical landmarks.
  - The source editors hide the focus outline (`&.cm-focused { outline: none }`); the cursor and active line are the only sign of focus.
  - Phone performance (Lighthouse 76 on the gallery, 86 on a guide) is the cover photo's paint time; untuned.
- [ ] **`pnpm e2e` stalled on the owner's Mac on the night of 2026-10-08/09.** From about 23:00 the dev server it starts (port 3210) stopped answering for minutes at a time, at a different test each run, with the machine idle; the same happened on the previous commit from a clean build, so it isn't from that night's changes. By hand the same server answered in under a second, and the network tested fine. Unexplained. Every test passed in at least one run except the last two together; The next morning the editor tests ran clean in 25 s with nothing changed, and CI passed throughout, so it was the machine that night; CI is the reference if it happens again.
- [ ] **Removal after the 72 hours waits for an editor's visit.** If nobody opens `/editor`, a deleted hike's data stays in the database and the bucket (unpublished, so not public). A timer could only do it with an admin key on the server, which was removed on purpose; a database-side job (pg_cron) could remove the rows but not the photo files.
- [ ] **Take a deeper look at the editor** (owner, 2026-10-09: "look deeper into changes for the editor at some point"). Starting points seen while adding block moves and icons: no drag and drop for blocks (only Move up/down, one neighbour at a time, and the buttons live in the settings column, which is a sheet on a phone); a block can't be duplicated in the Write view; the Pins view has no phone layout; the Write view steps aside for images, code blocks and footnotes; three "Coming later" entries are still listed in the insert menu.
- [ ] **An orphaned `pnpm start` on port 3101** (started 2026-09-29) was still running on the owner's Mac on 2026-10-07.

## Refactors worth doing soon (from the same audit)

None changes behaviour; each needs the tests named first.

- [ ] Colour token names no longer describe their colours (`bark` is slate grey, `paper` is off-white, `ochre` is yellow) since the Fresh Green theme of 2026-10-08. A rename to the design's names (pine, slate, page, sunny, ink) is mechanical but touches every component. `scripts/make-sample-photos.ts` still draws its placeholders in the paper palette.

- [ ] One builder for a new hike: `scripts/import-gpx.ts` and `scripts/ingest-photos.ts` hand-write the YAML that `src/lib/new-hike.ts` builds (check `pnpm ingest --dry-run` output).
- [ ] One guard helper for the two editor API routes (the chain editor → origin → size → rate limit → JSON is written twice). `routes.test.ts` now covers both, so it's safe to extract.
- [ ] Editor form primitives are copied four times (the input class, `Field`, the number helper): `DetailsForm`, `ComponentSettings`, `PinsView`, `NewHikeForm`. `PinsView` now has `RequiredText` and `NumberDraft`, which the others could use.
- [ ] Map code is triplicated (route GeoJSON and layer, bounds, the failure check, the loaded/failed state) across `MapboxTrailMap`, `PinMap` and the gallery map. Visual, no tests: check in a browser.
- [ ] `registry` (`components/mdx/registry.tsx`) repeats the manifest for the editor; the editor could read `manifest` directly.
- [ ] "Which pin does a new block get" is written in both `WriteView` and `AdvancedView` and has drifted.
- [ ] Scripts repeat `loadEnvFile`, the service-client setup and `main().catch`; a `scripts/lib/env.ts` would hold them.
- [ ] `getHikePage` lists every hike to get one hike's details (a second query per render with Supabase); `HikeRecord` could carry `details`.
- [ ] Gallery client components take their type from the `server-only` `lib/content.ts`, and the whole frontmatter of every hike is sent to the gallery; a `Pick` of what the cards use would do.
- [ ] Small numeric helpers are repeated (`round` four times, the 0.05 mi snap distance twice, "renumber in steps of 10" twice).
- [ ] `pnpm ingest` still uploads photos before the pins are validated; it now checks the stored guide first, but a refused save after that leaves uploads behind.

## V2: editing (in progress, see [v2-plan.md](v2-plan.md))

- [ ] Remaining differences from the design's authoring view (*Trail Guide Branded*, screen 3a):
  - **Frame options per component** ("Show footer", "Allow expand ⤢"): `Frame` has these as code props, but they aren't in the manifest.
  - **A "drop photo or browse" field** on the photo card: waits on photo uploads.
  - **A scroll-synced preview:** the preview scrolls to the selected component, but doesn't follow the source as you scroll.

- [ ] E2 leftovers once it's live:
  - An E2E suite (`@playwright/test`): signed out and signed-in non-editor get 404 on `/editor` and the save API; an editor can save; the conflict banner. Today these were checked by hand with ad hoc Playwright scripts and curl.
  - Every autosave writes a revision row; prune or coarsen later.
  - `pnpm photos check` reads `content/`, not the database.
  - The editors can't preview a draft as a full page on the live site (drafts have no public page).
- [ ] E3 leftovers:
  - Write view: no Duplicate (the Markdown view has it); no drag-to-reorder for blocks (cut and paste works).
  - "Autosaved 2 min ago" instead of a clock time.
  - Write view: support images, code blocks, reference links and footnotes, or refuse them in the gate. Today a guide that has one can only be edited under Advanced.
  - The editor's top bar on a phone wraps to three rows.
- [ ] E4 leftovers:
  - The pin form's photo picker only offers photos the hike's pins already use. Listing everything uploaded for the hike needs a small server route over the Supabase bucket.
  - No undo in the Pins view (the Write view has it); the History tab can restore an earlier saved version.
  - Out-and-back hikes: a new pin on a stretch walked twice is placed on the first pass; a "which way" choice would be clearer than moving it in the list.
  - Commit the pin-editor browser checks as an E2E test.
- [ ] E5 leftovers:
  - Replace a hike's track from the app (today: `pnpm gpx --slug <slug> --guides postgres`).
  - The new-hike form doesn't share code with the Details form.
- [ ] Phone layout for the editor: design 3a is desktop-only (three columns, fixed 290px settings column), and live-site editing is meant to work from the phone.

## Left over from V1 (unscheduled; pick up after V2 or between milestones)

- [ ] `<ElevationProfile />` from `track.json`: a scrubber synced with the maps through the hike store (was V1 M4). Strawberry Peak is the test case.
- [ ] A Lighthouse pass on `/hikes/strawberry-peak` (the cheap accessibility fixes are in; nothing has been measured). The guide page loads about 301 KB of JS (brotli) before Mapbox.
- [ ] A Content-Security-Policy, starting report-only (the editor preview evaluates compiled MDX; Mapbox needs `blob:` workers).
- [ ] Show "Hiked <date>" on the guide (the frontmatter has it; the page doesn't).
- [ ] Gallery: region filter, search, sort (including nearest), mobile pull-up sheet, "Load more". Only worth it with more hikes.
- [ ] About page, "⋯" frame menu, drive time next to directions.
- [ ] GPX export button (the route only, never timestamps).
- [ ] Photo upload leftovers (the upload itself shipped 2026-10-08): the Pins view has no phone layout; `pnpm photos check` and CI still read only the repo's guides; photo files nothing uses are only removed by hand (Unplaced → Delete); several photos per pin.

## v3/v4

- [ ] Auto node placement from a bulk photo upload, with a duplicate-view check ([backlog.md](backlog.md)).
- [ ] Several photos for one point, e.g. at a trail fork ([backlog.md](backlog.md)).
- [ ] Real 360° photos (the `PanoViewer` is built and shows a placeholder), video clips (Strawberry Peak has two short ones), sun/shade simulator, viewshed map.

## Known issues (not blocking)

- Mapbox tiles return 403 on `localhost`, because the token is URL-restricted. Add `localhost:3100` to the token in the Mapbox account if the dev maps look patchy.
- `fixtures/sample-photos` (4.9 MB of JPEGs) are committed. Fine for now; they feed the samples and could feed future ingest tests.
