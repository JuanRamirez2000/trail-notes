# Backlog

Feature ideas that aren't scheduled yet. Each entry says why it matters and how it would work.

## Auto node placement from a bulk photo upload

**Status:** idea, suggest once the site is in production use. Not scheduled for V1.

**Why:** people take far too many photos at some spots (four at one bend, three at the summit) and none along long, uneventful stretches. Ingest currently turns every photo into a pin, so a bulk upload produces a cluttered guide that has to be pruned by hand. The GPX track already says where the trail changes character; photos should be used to *illustrate* those points, not to decide them.

**How it worked by hand for Strawberry Peak (Oct 2026):** 19 photos became 6 pins.

1. **Find breakpoints on the track** from the full-resolution GPX (timestamps included; they stay local and are never published):
   - grade regime changes, from smoothed elevation over 0.1 mi bins (e.g. a steady 5–9% climb flattening to 1–4% at mile 1.06 = "trail wraps around the mountain")
   - local elevation minima between climbs (the saddle at mile 2.39)
   - pace changes against the hiker's own baseline (20 min/mi → 45–80 min/mi at mile 2.73 = "rocky climb begins"; also the steepest pitch at 26–28%)
   - stops of 2+ minutes, which tend to sit exactly on these points; a long stop at the high point marks the summit
2. **Cluster the photos** by position along the track (`locateAllOnTrack` in capture-time order; consecutive photos less than 0.08 mi apart form one group).
3. **Keep only the clusters that sit on a breakpoint** (within about 0.1 mi), plus start and end. Pick one photo per cluster; any rule is fine to start (first in the cluster), and sharpness or the user's favourites could rank them later.
4. **Draft each pin from the data:** type `note` (or `turn` when the bearing changes sharply), a label, and a caption built from grade, elevation, mileage and pace. Photos that land on an existing pin (trailhead, high point) attach to it instead of adding a new one.
5. **Check for duplicate views across pins.** If two pins would show the same scene, swap one for another photo from near that pin. On Strawberry Peak the saddle and rocky-climb picks were the same eastern ridge panorama (67° and 73°, 12 minutes apart), so the saddle got the north-facing shot of the peak ahead instead. A perceptual hash alone did **not** catch it: every pair scored as unrelated (dHash distance 100+ out of 256), because the framing differed. Combine a heading check (within ~20°) with a content comparison that tolerates reframing (e.g. image embeddings), and treat a match as "same vista", not "same file".
6. **Show the result as a draft for review** in the editor, with the dropped photos listed so one can be swapped in.

**Pieces that already exist:** `src/lib/track.ts` (projection and forward search), `src/lib/ingest.ts` (`mergeWaypoints`, snapping, numbering), `src/lib/gpx.ts` (parsing, elevation smoothing). The missing piece is breakpoint detection, which needs timestamps. Today `pnpm gpx` drops them, so detection would run at import time and store only the breakpoints (mileage and kind), never the times.

**Open questions:** what pin type a saddle should get (junction or landmark); whether to include video clips (Strawberry Peak had two short ones, at the parking lot and near the summit); and whether to keep dropped photos in storage as a per-pin gallery.

## Several photos for one point (v3/v4)

**Status:** later, after the MVP. For now each pin shows one photo, and duplicate views are swapped out (see above).

**Why:** some points need more than one view. At a trail fork you want the fork itself plus a photo down each branch, or a look around a viewpoint. Today the extra photos are simply dropped.

**How:** let a waypoint carry `photos[]` (primary first) and show them as a small gallery or carousel in its `<Step>`, each with its own heading cone on the map. The duplicate-view check would then only apply between pins, never within one.

## Sun and shade along the route

**Status:** planned with the owner on 2026-10-09. Build stage 1 next; stage 2 is a later, larger feature.

**Why:** whether a climb is in full sun at the hour you'll be on it changes how much water to carry and when to start. It depends on the date and the time of day, so it can't be one sentence in a guide.

**Stage 1: a sun band on the elevation profile (estimated, and labelled as an estimate).**

- The reader picks a date and a start time (defaulting to today and a sensible morning hour). For each stretch of the route the block works out when they'd be there and where the sun is then, and shades the profile: sun in your face, on your back, low, or below the horizon; exposed slope or slope facing away.
- **Pace is estimated**, with the owner's agreement: the app keeps no timestamps, so arrival times come from distance and climb (a Naismith- or Tobler-style rule: a base walking pace, plus time per unit of climb, slower on steep descents). The guide's own `estTime` can scale it. Shown as "about 9:40" style times, never as a promise.
- **Sun position** is plain astronomy from latitude, longitude, date and time. The `suncalc` library does it in the browser in a few hundred lines, with no service or key. (An API isn't needed for this stage; one was looked for on 2026-10-09 and only matters for stage 2.)
- **Is the slope in shade?** From the route alone: the track gives each stretch's direction of travel and its gradient, so the block can say whether the hillside it's climbing faces the sun. It can't see a ridge across the valley or tree cover. So: an optional per-stretch note from the author ("under oaks from mile 1 to 2"), and wording that says "estimate from the route's shape; trees and nearby ridges aren't counted".
- Fits the existing pieces: `src/lib/elevation.ts` (profile samples with mileage), `src/lib/track.ts`, and `<ElevationProfile />`, which already shares the selection with the maps. It would be a new block, `<SunShade />`, or an option on the profile.

**Stage 2: a map layer that animates through the day** (what the owner first had in mind; "way too hard" to start with).

- Much less hard than building it: ShadeMap's `mapbox-gl-shadow-simulator` is a ready-made layer for Mapbox GL that ray-casts terrain shadows for any date and time, and can include tree canopy and buildings. It needs an API key from shademap.app; the price for a small site wasn't found on 2026-10-09 and has to be asked. Shadowmap.org has an API too.
- Until that's settled, stage 1 costs nothing and has no outside dependency.

**Open questions:** the default start time (fixed, or sunrise plus something); whether the estimate should also say "you'd finish after sunset"; ShadeMap's terms and price.

## Viewshed map

**Status:** later (owner, 2026-10-09). No design yet.

**Why:** show what you can see from a viewpoint pin: which ridges and valleys are in view.

**How, roughly:** needs terrain elevation around the pin (Mapbox Terrain-DEM tiles, which the token already covers, or an elevation API), a line-of-sight sweep from the pin, and a shaded overlay on the map. It only earns its place once guides have viewpoint pins with photos to compare against.

## Video overlays: guide blocks exported for the owner's videos

**Status:** way down the line (owner, 2026-10-09). Not a feature of the site, and not for visitors.

**What it is:** the owner makes YouTube hiking guides and wants the app's blocks as overlays in those videos: for example the minimap, following the route, composited into a corner of the footage. The videos are not hosted in the app. (Until 2026-10-09 this was listed in the editor's insert menu as "Video overlay", as if it were a guide block; that entry was removed.)

**How, roughly, when the time comes:** an owner-only export view per guide that renders one block on a transparent or keyed background at video resolution (1080p or 4K), driven by a timeline instead of by scrolling: "the minimap from mile 0 to mile 3.6 over 40 seconds". Output as a PNG sequence or a WebM with alpha, captured from the browser (Playwright is already in the repo for the tests), for import into a video editor. Candidates: the minimap with its heading cone, the elevation profile with a moving marker, a step title card, the safety strip.

**Open questions:** which editor it has to import into (that decides the format); whether the overlay should follow the real recording's timing (the app keeps no timestamps, so that would mean reading the GPX on the owner's Mac at export time) or an even pace; resolution and frame rate.

## Accounts, sign-in and getting around

**Status:** to plan with the owner (2026-10-09: the "fully featured" list should cover "auth, user account, buttons to go between navigations"). Stage A needs no decisions; B and C do.

**Where things are today:** only editors can sign in (Google, through Supabase Auth; sign-ups are closed and the Google consent screen is in Testing with listed test users). There is no link to sign in anywhere: you have to know `/sign-in` or `/editor`. A signed-in editor looking at a guide has no way to get to its editor, and the public header shows nothing about being signed in. Guides link back to the gallery but not to each other.

**Stage A: the buttons (no new kind of account).**

- Header: a quiet "Sign in" link; for a signed-in editor, "Editor" and an account menu (name, sign out) instead. Public pages are static and cached, so the header can't know who's looking at render time: a small client component asks a new endpoint (`/api/session`: signed in or not, name, role) after the page loads, and the pages stay cached.
- Guide page: "Edit this guide" for editors; previous and next guide at the bottom; the existing "← All hikes".
- Editor: "View site" in the hike list (each hike already has "View page").
- Sign-in page: say what signing in is for, and where you land afterwards (back where you came from).

**Stage B: accounts for visitors.** The question to answer first is what a signed-in visitor can do that a signed-out one can't. Candidates, from least to most work: save hikes to a list; mark a hike as done; report a condition ("creek dry on 10/3") for the owner to review; comment. Each needs sign-ups opened (so: the Google consent screen out of Testing, a privacy note, and a `profiles` table with its own access rules, since today's tables are closed to every browser role), and each makes the site hold other people's data.

**Stage C: roles for writers.** Today a person on the editors list can do everything. If others write guides: a contributor who can create and edit their own drafts while only the owner publishes. `can()` in `src/lib/auth/can.ts` was written to take the action and the hike for exactly this, so it's a change in one place plus an owner column on hikes.

**Open questions:** does the site need visitor accounts at all for a couple of guides, or only stage A; if yes, which of the candidates; whether anyone but the owner will write guides.
