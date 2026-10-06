# TODO

Grouped by the version each item belongs to. Move items to [changelog.md](changelog.md) when they ship; put larger unscheduled ideas in [backlog.md](backlog.md).

## V2: editing (in progress, see [v2-plan.md](v2-plan.md))

- [ ] Remaining differences from the design's authoring view (*Trail Guide Branded*, screen 3a):
  - **Frame options per component** ("Show footer", "Allow expand ⤢"): `Frame` has these as code props, but they aren't in the manifest.
  - **A "drop photo or browse" field** on the photo card: waits on photo uploads.
  - **A scroll-synced preview:** the preview scrolls to the selected component, but doesn't follow the source as you scroll.
  - **"Publish" and "Autosaved 2 min ago"** in the top bar (we have "Save" and a draft/published badge). Planned in E3.
- [ ] **E2 go-live (owner):** Google client, Supabase Auth settings, the editors list, Vercel variables, then the checks. All in [e2-go-live.md](e2-go-live.md).
- [ ] E2 leftovers once it's live:
  - An E2E suite (`@playwright/test`): signed out and signed-in non-editor get 404 on `/editor` and the save API; an editor can save; the conflict banner. Today these were checked by hand with ad hoc Playwright scripts and curl.
  - History is written but has no UI: no list of revisions, no restore button (rows are in `hike_revisions`).
  - Every autosave writes a revision row; prune or coarsen later.
  - `pnpm photos check` reads `content/`, not the database.
  - The editors can't preview a draft as a full page on the live site (drafts have no public page).
- [ ] E3 leftovers:
  - Write view: required pins without a `<Step>` still get a generated section on the page but aren't shown in the document. Show them as "add this section" placeholders.
  - Write view: no Duplicate (the Markdown view has it); no drag-to-reorder for blocks (cut and paste works).
  - "Autosaved 2 min ago" instead of a clock time; a publish confirmation.
  - The editor's top bar on a phone wraps to three rows.
- [ ] V2 milestones left: E4 map and pin editor, E5 create a hike in the app ([v2-plan.md](v2-plan.md)).
- [ ] Phone layout for the editor: design 3a is desktop-only (three columns, fixed 290px settings column), and live-site editing is meant to work from the phone.

## Left over from V1 (unscheduled; pick up after V2 or between milestones)

- [ ] `<ElevationProfile />` from `track.json`: a scrubber synced with the maps through the hike store (was V1 M4). Strawberry Peak is the test case.
- [ ] Favicon from the logo badge (`/favicon.ico` currently 404s), Open Graph image per hike, `sitemap.ts` / `robots.ts`.
- [ ] Accessibility and Lighthouse pass on `/hikes/strawberry-peak`.
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
