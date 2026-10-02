# TODO

Grouped by the version each item belongs to. Move items to [changelog.md](changelog.md) when they ship; put larger unscheduled ideas in [backlog.md](backlog.md).

## V2: editing (in progress, see [v2-plan.md](v2-plan.md))

- [ ] **The editor preview ignores `track.json`:** `parseWaypoints` in `src/components/editor/compile.ts` calls `deriveWaypoints` without the track, so preview mileages are straight-line estimates (Strawberry Peak's differ from the live page). Load the track in `src/app/editor/[slug]/page.tsx` and pass it through.
- [ ] Everything in the V2 plan's milestones.

## Left over from V1 (unscheduled; pick up after V2 or between milestones)

- [ ] `<ElevationProfile />` from `track.json`: a scrubber synced with the maps through the hike store (was V1 M4). Strawberry Peak is the test case.
- [ ] Favicon from the logo badge (`/favicon.ico` currently 404s), Open Graph image per hike, `sitemap.ts` / `robots.ts`.
- [ ] Accessibility and Lighthouse pass on `/hikes/strawberry-peak`.
- [ ] Gallery: region filter, search, sort (including nearest), mobile pull-up sheet, "Load more". Only worth it with more hikes.
- [ ] About page, "⋯" frame menu, drive time next to directions.
- [ ] GPX export button (the route only, never timestamps).
- [ ] Photo uploads from the live site / phone (deferred from V2 E5): browser → Supabase through short-lived signed upload URLs from a server route (server-only key on Vercel). Spike first: iOS Safari may convert HEIC and may strip location from photos picked in the browser, and sharp can't decode HEIC.

## v3/v4

- [ ] Auto node placement from a bulk photo upload, with a duplicate-view check ([backlog.md](backlog.md)).
- [ ] Several photos for one point, e.g. at a trail fork ([backlog.md](backlog.md)).
- [ ] Real 360° photos (the `PanoViewer` is built and shows a placeholder), video clips (Strawberry Peak has two short ones), sun/shade simulator, viewshed map.

## Known issues (not blocking)

- Mapbox tiles return 403 on `localhost`, because the token is URL-restricted. Add `localhost:3100` to the token in the Mapbox account if the dev maps look patchy.
- `fixtures/sample-photos` (4.9 MB of JPEGs) are committed. Fine for now; they feed the samples and could feed future ingest tests.
