# TODO

Grouped by the version each item belongs to. Move items to [changelog.md](changelog.md) when they ship; put larger unscheduled ideas in [backlog.md](backlog.md).

## Before the first tagged release

From the audit of 2026-10-06 ([changelog.md](changelog.md)). The code fixes are in; these need the owner or a decision.

- [ ] **Capture times still stored (owner).** New saves and the public page no longer carry `takenAt`, but it is still in:
  - the stored pins of the three guides in Supabase, until each is saved again (`pnpm content seed --force` writes the cleaned files over them; pull first if the live text has changed);
  - old rows of `hike_revisions`;
  - the public repo's git history (`content/hikes/*/waypoints.json` before 2026-10-07). Removing it means rewriting history and force-pushing.
- [ ] **Run `pnpm content check --store supabase`** once the fixes are deployed: the no-code rule is stricter now (links, `<Step>` inside a paragraph), and this confirms no stored guide relied on what it used to allow.
- [ ] **Backups.** The free Supabase plan has none, and the database is the only copy of edits made on the live site. A scheduled `pnpm content pull` (committed, or to a private place) would cover the text; the photo originals exist only on the owner's Mac.
- [ ] **Nothing watches `/api/health`.** It answers 503 when the store can't be read, but only Vercel's daily cron calls it. Point an uptime monitor at it. There is no error reporting or analytics either.
- [ ] **CI doesn't check the stored guides:** the `SUPABASE_SERVICE_ROLE_KEY` repository secret isn't set, so that step is skipped (owner adds it in GitHub).
- [ ] **The release itself** is planned step by step in [v0.1-plan.md](v0.1-plan.md) (`v0.1.0`, MIT for the code, decided 2026-10-08).
- [ ] **An orphaned `pnpm start` on port 3101** (started 2026-09-29) was still running on the owner's Mac on 2026-10-07.

## Refactors worth doing soon (from the same audit)

None changes behaviour; each needs the tests named first.

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
- [ ] **E2 live checks (owner):** what's still unverified on the live site is in [e2-go-live.md](e2-go-live.md).
- [ ] E2 leftovers once it's live:
  - An E2E suite (`@playwright/test`): signed out and signed-in non-editor get 404 on `/editor` and the save API; an editor can save; the conflict banner. Today these were checked by hand with ad hoc Playwright scripts and curl.
  - Every autosave writes a revision row; prune or coarsen later.
  - `pnpm photos check` reads `content/`, not the database.
  - The editors can't preview a draft as a full page on the live site (drafts have no public page).
- [ ] E3 leftovers:
  - Write view: no Duplicate (the Markdown view has it); no drag-to-reorder for blocks (cut and paste works).
  - "Autosaved 2 min ago" instead of a clock time; a publish confirmation (Unpublish is one click, and editing a published guide autosaves to the public page).
  - Write view: support images, code blocks, reference links and footnotes, or refuse them in the gate. Today a guide that has one can only be edited under Advanced.
  - The editor's top bar on a phone wraps to three rows.
- [ ] E4 leftovers:
  - The pin form's photo picker only offers photos the hike's pins already use. Listing everything uploaded for the hike needs a small server route over the Supabase bucket.
  - No undo in the Pins view (the Write view has it); the History tab can restore an earlier saved version.
  - Out-and-back hikes: a new pin on a stretch walked twice is placed on the first pass; a "which way" choice would be clearer than moving it in the list.
  - Commit the pin-editor browser checks as an E2E test.
- [ ] E5 leftovers:
  - Replace a hike's track from the app (today: `pnpm gpx --slug <slug> --guides supabase`).
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
- [ ] Photo uploads from the live site / phone (deferred from V2; live-site editing is now E3): browser → Supabase through short-lived signed upload URLs from a server route (server-only key on Vercel). Spike first: iOS Safari may convert HEIC and may strip location from photos picked in the browser, and sharp can't decode HEIC.

## v3/v4

- [ ] Auto node placement from a bulk photo upload, with a duplicate-view check ([backlog.md](backlog.md)).
- [ ] Several photos for one point, e.g. at a trail fork ([backlog.md](backlog.md)).
- [ ] Real 360° photos (the `PanoViewer` is built and shows a placeholder), video clips (Strawberry Peak has two short ones), sun/shade simulator, viewshed map.

## Known issues (not blocking)

- Mapbox tiles return 403 on `localhost`, because the token is URL-restricted. Add `localhost:3100` to the token in the Mapbox account if the dev maps look patchy.
- `fixtures/sample-photos` (4.9 MB of JPEGs) are committed. Fine for now; they feed the samples and could feed future ingest tests.
