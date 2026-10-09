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
