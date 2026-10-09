# Changelog

Newest first. Commit hashes refer to `main`.

## After v0.1.0

- **Photo storage without the admin key** (2026-10-08, owner's call): the photo routes act as the signed-in editor, and new bucket policies (migration `0003`) let people on the editors list add, list and delete photos in `hikes`. The site no longer reads `SUPABASE_SERVICE_ROLE_KEY`. It's also the groundwork for a Supabase client in the browser later: the policies are what such a client would rely on. A dev server with no sign-in can no longer upload to the live bucket. The policies are tested in CI against the scratch Postgres (stand-ins for `auth.uid()` and `storage.objects`); the migration is applied to the live database and its policies were checked there in SQL, read-only. A real signed upload is still the owner's to try.
- **Photo upload in the editor** (2026-10-08): photos added or dropped in the Pins view are read, resized and re-encoded in the browser (two webp variants, no metadata), uploaded straight to storage through URLs the server signs, and pinned where they were taken with the same rules as `pnpm ingest`. Photos without GPS, or taken off a pin, wait under "Unplaced", from where they can be placed on the map or deleted; the server refuses to delete a photo the saved or published guide still uses, and deleting a draft removes its photos. Differences from the outside review's proposal, each for a reason found in the code: a WASM webp encoder instead of a JPEG fallback (the bucket and every URL are webp-only), the server numbers the files (a client index could land on an old file), no Supabase client in the browser, and no automatic deletion when a pin loses its photo (Strawberry Peak's cover is on no pin, and the published copy may still show it). Checked: unit and route tests, an end-to-end test on a throwaway hike with photos on disk, and the WASM path forced in Chromium. Not checked: a signed upload to the real bucket, and a real iPhone ([todo.md](todo.md)).
- **Ingest rules in one shared module** (2026-10-08): `scripts/lib/ingest.ts` moved to `src/lib/ingest.ts` and gained the EXIF reading, capture order, variant sizes, key naming and pin construction that were inside `scripts/ingest-photos.ts`. First step of photo upload in the editor. A fresh ingest of the granite-saddle sample photos gives byte-identical pins, guide stub and image files before and after.
- **Landing page, second pass** (2026-10-08): a shorter hero (the latest guide's cover, one line, one button), and the features are now the guide's own blocks, live, from the latest published guide: photo card, route map, elevation profile, minimap with the step list, and "Before you go", each beside a sentence or two. Picking a pin on one moves the others.
- **Landing page and footer** (2026-10-08): `/` is now a short landing page (what Trailnotes is, the latest guide, what's in a guide) and the gallery moved to `/hikes`. The footer has the wordmark, links to the gallery, the latest guides, the repo and the licence, above the "conditions change" reminder. "All hikes" links, the sitemap and the refresh after publishing follow the move; axe is clean on both pages.

## v0.1.0 (2026-10-08): the first tagged release

Tagged `v0.1.0` on `main`. Planned with the owner on 2026-10-08 as twelve steps, each one verified commit: licence, app icons, dependency patches, delete a draft, Write view placeholders, the database layer on Drizzle, history and restore, draft and published copies, the elevation profile, an accessibility pass, the end-to-end suite, and retiring `e2-go-live.md`. The Fresh Green theme was added along the way. MIT for the code; guides and photos stay all rights reserved. Left out on purpose: photo uploads from the app (needs an iOS/HEIC spike), a phone layout for the editor, Write view support for images and code blocks, a Content-Security-Policy, and the refactors in [todo.md](todo.md). What the owner still has to do or check is in [todo.md](todo.md).

- **Licence** (`49169d8`): MIT for the code; guides and photos all rights reserved.
- **Dependencies:** next 16.3.6 → 16.3.8 (two high and four lower advisories: image-optimisation SSRF, ISR cache poisoning, metadata-route disclosure), `source-map-js` 1.2.2 (high, build-time), and patch releases of mdxeditor, vitest and jsdom. `pnpm audit --prod` is clean on 2026-10-08. Minor and major releases (next 16.4, react 19.3, mapbox-gl 3.32, TypeScript 7, ESLint 10) are left for later.
- **`e2-go-live.md` retired:** the setup steps and what was verified are in [current.md](current.md); the checks only the owner can do are a short list in [todo.md](todo.md).
- **End-to-end tests** (`pnpm e2e`, Playwright, in CI): outsiders get a 404 from the editor and its API, an editor creates a hike and saves, a stale tab gets the conflict banner, and publish, publish changes, unpublish and delete work.
- **Accessibility pass** (2026-10-08): axe is clean on the gallery, a guide page and every editor view; Lighthouse accessibility is 100 (scores in [current.md](current.md)). Fixed on the way:
  - the gallery had no page heading on a phone;
  - the editor had no `<main>` and no heading, and its "⌘S" hint and line numbers were too faint;
  - the Write view's toolbar wasn't picking up the site's colours at all (MDXEditor's defaults won), leaving a 1.9:1 placeholder;
  - the Markdown and pins editors had no accessible name;
  - map pins were 22 px touch targets, now 24;
  - the elevation profile's pins overlapped as buttons on a phone, so the plot now selects the nearest pin instead.
- **Elevation profile:** `<ElevationProfile />` draws the climb along the recorded track with the hike's pins on it; hovering reads off mile and elevation, and choosing a pin selects it on the maps and scrolls to its section. On Strawberry Peak, under the route map.
- **Fresh Green theme** (2026-10-08): the palette from the design project's *Trailnotes Design System* replaces the paper theme: green primary, white cards on an off-white page, slate secondary text, a yellow accent. Only the token values changed, plus the app icons and the last-resort error page. Text pairs were checked at 4.5:1 or better (the lowest is primary on highlight, 4.54).
- **Live on Drizzle** (2026-10-08): migrations `0001` and `0002` applied to the live database with `pnpm db:migrate`, then `fd626b3` and `4d66750` went to `main` (PR #1, rebased). Checked afterwards: Strawberry Peak's published copy equals its working copy, the two drafts have no `draft:` line, `save_hike`/`create_hike` are gone, every stored guide passes the save gate, the guide page is 200, `/api/health` says `"store":"postgres"`, and signed out the editor and its API are 404.
- **Draft and published copies** (`4d66750`)**:** the editor saves a working copy and the site shows the published copy, which changes only on Publish ("Publish changes" when they differ); Unpublish asks first. The `draft` frontmatter flag is retired. `pnpm content seed/pull/check` handle both copies.
- **Drizzle everywhere** (`fd626b3`)**:** the supabase-js guide store, `save_hike` and `create_hike` are gone (`CONTENT_STORE` is `local` or `postgres`); the editors lookup and `pnpm editors` use Drizzle too, so the site no longer needs the Supabase service-role key.
- **History:** a History tab in the editor lists every saved version with who saved it and a preview; restoring one loads it into the editor and saves it as the newest version.
- **Database layer on Drizzle:** the tables are defined in TypeScript (`src/db/schema.ts`), with migrations generated into `drizzle/` (the baseline matches the live database exactly). A Drizzle store (`CONTENT_STORE=postgres`, `DATABASE_URL`) does each change in one TypeScript transaction, passes the same contract as the others, and CI runs it against a Postgres service. Pins are now checked to read back byte for byte. The live site stays on supabase-js until the owner switches.
- **Generated sections in the Write view:** pins whose section the page writes on its own are listed above the document, each with "Write this section", which adds an empty `<Step>` where the page shows it (the page looks the same until you type).
- **Delete a draft** from the editor (end of the Details view). Published guides are refused, and so is a stale version. Its history is deleted with it, so the address can be used again; there's no undo.
- **App icons:** favicon, SVG icon and Apple touch icon from the logo badge (`src/app/icon.svg`; `pnpm icons` renders the other two).

## V2 (from 2026-10-01): editing

- **Audit and fixes** (2026-10-06/07). Three agents read the whole repo (bugs, refactors, release readiness); everything below came out of that.
  - **Security:**
    - The no-code rule accepted `{/* a */ code /* b */}` as a comment, so a saved guide could run code during page render; the same pattern took exponential time. Replaced with a linear scan, with the hostile inputs as tests.
    - Links and images can only point to `http(s)`, `mailto`, `tel` or this site.
    - Pin labels are escaped in the 360° viewer's markers (they were inserted as HTML).
    - `<RouteMap __proto__=…>` no longer slips past the unknown-prop check.
    - `/sign-in?error=__proto__` no longer returns a 500.
    - The editor API answers 404 to every method; `/api/health` no longer reports the number of drafts.
    - Security headers on every response; `pnpm dev` listens on this machine only.
  - **Privacy:** pins no longer carry the photo's capture time (`takenAt`). It was in the public page's data. Removed from the schema, from `pnpm ingest` and from `content/`.
  - **Editor:**
    - One save at a time: a slow save no longer makes the editor conflict with itself.
    - Leaving with unsaved text asks first.
    - The Write view steps aside for Markdown it can't show instead of silently dropping edits.
    - Clearing a pin's label or title, or typing an out-of-range position, no longer throws you out of the Pins view.
    - A YAML error in the details is shown instead of a form that does nothing, and Publish says why it can't.
    - Pin rename and "used by" see every way a reference can be written.
    - After Publish or Unpublish the server refreshes the page itself, so no visitor is served the old one.
  - **Data:**
    - The local store no longer deletes a `track.json` it can't read, and queues writes so two saves from one version can't both pass.
    - GPX: signed and exponent coordinates, namespaced tags and route points are read; a missing elevation is filled from its neighbours; day-long recordings no longer overflow the stack; coordinates are range-checked.
    - A new hike's summary can contain `{` or `<`; a very short recording gets a distance above zero.
    - Snapping no longer pulls a pin from one switchback leg to the one below.
    - `new` is refused as an address everywhere, not only in the form; a mistyped `CONTENT_STORE` stops the build.
  - **Site:** `robots.txt`, `sitemap.xml`, Open Graph and Twitter cards, canonical links, an error page, a footer, a skip link, reduced-motion scrolling, one `<h1>` on the guide page, dark ink on turn pins (contrast), "1 hike", an empty state for no hikes, the gallery map hidden until painted, Best season in the phone's stats.
  - **Cleanup:** the store's unused `setStatus` and the `publish` action removed; one frontmatter regex and one slug pattern; stale comments and the README brought up to date.
  - **Tests:** 169 → 235, including the two editor API routes and the editor's save loop.

- **E5: New hike in the app** (2026-10-05): a form with an optional GPX read in the browser creates a draft hike and opens it in the editor.
- **E4: Pins view** (2026-10-05): pins on an interactive map (drag, aim the photo direction, add by clicking), a list in route order, and a form per pin; renaming a pin updates the guide.
- **E3: Write view, guide details form, Publish** (2026-10-05):
  - The editor opens in a document-style Write view with the real components as live blocks and their settings beside them.
  - Guide details are a generated form; raw Markdown and JSON moved under Advanced.
  - Fixed: map pins appearing twice while Mapbox was loading.
- **E2: guides in Supabase, sign-in, guardrails** (built 2026-10-05, commits `2c2c713`, `4ec6560`; switched on for the live site the same day by the owner):
  - `ContentStore` with local-file and Supabase backends; every write validated and version-checked; history rows.
  - Guides can't carry code (`remark-no-code`).
  - The site and editor read and save through the store; pages refresh on save. Velite removed.
  - Supabase tables with server-only row-level security; `pnpm content` and `pnpm editors`.
  - Google sign-in scaffold with an editors allow-list; `/editor` stays a 404 until `EDITOR_AUTH=supabase`.
- **E1: component manifest, settings panel, movable blocks** (2026-10-02):
  - The manifest drives the build checks, the editor forms and the insert menu.
  - The save API refuses MDX that wouldn't build.
  - New blocks `<BeforeYouGo />`, `<SafetyPoints />`, `<Steps />`, and a per-guide `sidebar` order.
  - Fixed: preview mileage now uses `track.json`.
  - Authoring view restyled from *Trail Guide Branded* 3a (2026-10-04): settings column on the right, click-to-select in the preview, Duplicate / Remove. `pnpm dev` pinned to port 3100.
- **E0 spike: go.** MDXEditor round-trips all guides; the shared editor config and a round-trip test run in CI. Photo uploads from the live site moved out of V2.

## V1 (2026-09-30 → 2026-10-01): groundwork, real data, Strawberry Peak

**Goal:** publish real hikes. Scope moved during the version: the planned map editor (M3) and elevation profile (M4) are now part of V2 / [todo.md](todo.md).

- **Tests and CI** (`32ab198`, `f848a5e`): Vitest suite and a GitHub Actions workflow. Pure script logic moved to `scripts/lib/` so it can be tested. `pnpm typecheck` runs `next typegen`.
- **Photos only in Supabase** (`32ab198`): `public/photos` untracked, dev-only local backend, production guard, `pnpm photos check|push|pull`.
- **Dev refresh fix** (`32ab198`): editing `waypoints.json`/`track.json` recompiles the post. This also fixed Velite's watcher not starting under Next 16.3 (argv vs `NODE_ENV`).
- **GPX parser fix** (`32ab198`): points written `lon` before `lat`, or self-closing, were dropped.
- **Samples set to drafts** (`32ab198`): `ridgeline-loop`, `granite-saddle`.
- **Track projection and merging ingest** (`4b187b0`): `src/lib/track.ts`. Ingest merges into existing waypoints, skips photos already ingested, continues the numbering, snaps to the track, and reports off-track and out-of-order photos.
- **Map render hygiene** (`42ad248`): memoised pins, cached CSS colour tokens.
- **Strawberry Peak published** (`f575ba6`, `aa9298f`): 6 pins at GPX breakpoints with one photo each, text from the recording, no duplicate views. Track matching slack now scales with distance from the track.
- **Docs:** [backlog.md](backlog.md) (auto node placement, several photos per point) and this knowledge folder.

## V0 (before 2026-09-30): scaffold

`78b6a18` → `693784d`. MDX hike guides with photo-derived waypoints, the Velite content layer, the Mapbox and sketch maps within WebGL limits, guide sections per pin with sidebar quick links and scrollspy, safety/landmark/ranger pins, the detailed `granite-saddle` sample, GPX support, the local `/editor` (CodeMirror + live preview + autosave), and a branded 404.
