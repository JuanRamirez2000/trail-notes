# Changelog

Newest first. Commit hashes refer to `main`.

## v0.1.0 (in progress, from 2026-10-08): the first tagged release

Plan: [v0.1-plan.md](v0.1-plan.md).

- **Licence** (`49169d8`): MIT for the code; guides and photos all rights reserved.
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
