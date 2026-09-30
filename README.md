# Trailnotes

Photo-by-photo hiking guides. Each hike is an MDX post with embedded map components; the route, turning points and view directions come from the EXIF data in your photos (GPS, timestamp, compass heading).

**Stack:** Next.js 16 (App Router) · Tailwind CSS v4 · Velite · Mapbox GL JS (via react-map-gl) · Photo Sphere Viewer · Turf · Zod · Zustand · Supabase Storage

```bash
pnpm install
cp .env.example .env.local   # add your Mapbox token
pnpm dev                     # http://localhost:3000
```

Maps render as a hand-drawn sketch until `NEXT_PUBLIC_MAPBOX_TOKEN` is set, so everything works offline too.

---

## How it fits together

```
~/photos/<hike>/*.jpg
   │  pnpm ingest <folder> --slug <slug>
   ▼
exifr (GPS · time · heading) → sort by time → fill headings (EXIF → bearing to next photo → blank)
   → sharp: webp 2400px + 480px thumb, all metadata stripped → /public/photos or Supabase
   → content/hikes/<slug>/waypoints.json (draft) + index.mdx stub
   │  you review and edit (by hand or in /editor)
   ▼
Velite: validates index.mdx + waypoints.json with the Zod schemas in src/lib/schemas.ts
   ▼
/hikes/[slug] (static) → MDX rendered with the component registry
   → <HikeProvider> store shared by RouteMap · Minimap · StepByStep · PhotoCard · PanoViewer · SafetyPins
```

```
content/hikes/<slug>/
  index.mdx            frontmatter + prose + components
  waypoints.json       one entry per photo / pin
scripts/
  ingest-photos.ts     EXIF → waypoints draft + web images
  make-sample-photos.ts  placeholder JPEGs with real EXIF, for trying the pipeline
src/
  app/(site)/          gallery (/) and hike guide (/hikes/[slug])
  app/editor/          local-only authoring view
  app/api/editor/      save endpoint (404 outside `next dev`)
  components/mdx/      guide components + registry.tsx
  components/map/      TrailMap (Mapbox, lazy) + SketchMap fallback
  components/gallery/  filters, all-hikes map, cards
  components/editor/   CodeMirror + live MDX preview
  lib/schemas.ts       single source of truth for content shape
  lib/hike-store.tsx   per-page Zustand store (active step, 360° look direction)
  lib/storage.ts       photo key → URL (local or Supabase)
  app/globals.css      design tokens (Tailwind @theme) from the Claude Design handoff
```

---

## Adding a hike

1. **Export your photos as JPEG** (keep location metadata on). HEIC originals work for EXIF, but sharp's prebuilt binaries can't decode HEVC, so convert first.
2. **Run the ingest script:**

   ```bash
   pnpm ingest ~/Pictures/granite-lakes --slug granite-lakes
   ```

   This creates `content/hikes/granite-lakes/` with a `waypoints.json` draft and an `index.mdx` stub (`draft: true`), and writes web-sized photos. Useful flags: `--storage supabase`, `--dry-run` (read EXIF, write nothing) and `--force` (overwrite an existing `waypoints.json`; without it the script writes `waypoints.draft.json` next to it instead).
3. **Review `waypoints.json`.** For each waypoint:
   - `id`: rename `wp-03` to something readable like `ridge-junction` (this is what MDX refers to)
   - `type`: `start | turn | viewpoint | water | bailout`
   - `label` (short map label), `title` (step instruction), `caption`, `note` (for safety pins)
   - `heading`: check any with `"headingSource": "inferred"`, and fill the ones left `null` (then set `"headingSource": "manual"`)
   - `mile`: optional real trail mileage. Without it, mileage is estimated from straight lines between photos, which reads low.
   - `step: false` keeps a pin (e.g. a water source) off the step list.
   - `order` values have gaps of 10, so you can slot in extra waypoints.
4. **Write the guide** in `index.mdx`, fill in the frontmatter, and set `draft: false`. Drafts show in `pnpm dev` but not in production.
5. `pnpm dev` and check the page, or use the editor (below).

Invalid content (unknown waypoint type, a slug that doesn't match its folder, a bad photo key…) fails `pnpm build` with a readable error.

### Components you can use in MDX

| Component | Props | What it does |
| --- | --- | --- |
| `<RouteMap />` | `height`, `labels`, `terrain` | All pins + route line, 3D terrain, legend |
| `<StepByStep />` | `showMeta` | Clickable steps; opens photos, drives every map |
| `<PhotoCard waypoint="id" />` | `caption` | Photo linked to its pin (360° photos switch to the viewer) |
| `<PanoViewer waypoint="id" />` | `markerRadiusMi` | 360° viewer; the inset map cone follows where you look |
| `<Minimap />` | `height` | Current step map (the page already puts one in the sticky rail) |
| `<SafetyPins />` | `height` | Water + bail-out layer, other pins faded |

### Adding a new component (later phases)

Build the component inside `<Frame>` and read or write shared state with `useHike(...)`, then add one entry to `src/components/mdx/registry.tsx`. It becomes available in MDX and shows up in the editor's insert menu automatically.

---

## The editor (`/editor`)

`pnpm dev`, then open http://localhost:3000/editor. It gives you a split view with CodeMirror for `index.mdx` / `waypoints.json` on one side and a live preview using the real components on the other. Autosave runs 1.5s after you stop typing (or press ⌘S). It validates with the same schemas as the build and refuses to write invalid content. The insert menu adds components at the cursor, pre-filled with a matching waypoint id.

It's disabled in production: the pages and the save API return 404 unless `NODE_ENV=development`.

---

## Try the pipeline with sample photos

The sample hike (`ridgeline-loop`) was generated this way:

```bash
pnpm sample:photos       # placeholder JPEGs with GPS/time/heading EXIF → fixtures/
pnpm ingest fixtures/sample-photos/ridgeline-loop --slug ridgeline-loop --force
```

Re-running with `--force` overwrites the hand-edited `waypoints.json`; without it you get a `waypoints.draft.json` next to it. `creekside-falls` and `granite-saddle` are frontmatter-only stubs so the gallery filters have something to filter. Delete all three when you add real hikes.

---

## Photo storage: Supabase

1. Create a Supabase project. Nothing else is needed; the ingest script creates a public `hikes` bucket on first run.
2. In `.env.local`:

   ```bash
   NEXT_PUBLIC_PHOTO_STORAGE=supabase
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service role key>   # local only, used by `pnpm ingest`
   ```

3. `pnpm ingest <folder> --slug <slug>` now uploads to `hikes/<slug>/...`.

Only the two web-sized, metadata-free webp copies are uploaded. Your originals (with exact GPS) never leave your machine. The site builds public URLs from the photo key, so moving storage later is a one-file change in `src/lib/storage.ts`.

---

## Deploying to Vercel

1. Push the repo to GitHub, then **Add New → Project** on Vercel and import it. The framework preset is detected, and `pnpm build` (runs `velite build --strict && next build`) is the build command.
2. Add environment variables (Production + Preview):
   - `NEXT_PUBLIC_MAPBOX_TOKEN`
   - `NEXT_PUBLIC_PHOTO_STORAGE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_BUCKET` (if using Supabase)
   - **Don't** add `SUPABASE_SERVICE_ROLE_KEY`, because the site never uploads.
3. In your Mapbox account, add the Vercel domain(s) to the token's URL restrictions.
4. Deploy. Every hike page is statically generated; adding a hike means committing its folder and pushing.

With the CLI: `npm i -g vercel`, `vercel link`, `vercel env add NEXT_PUBLIC_MAPBOX_TOKEN`, then `vercel --prod`.

---

## Notes

- **Mapbox costs:** each map counts as a map load. Maps only mount when scrolled near the viewport, and the small inset maps skip 3D terrain. The free tier is 50k loads/month.
- **Timestamps:** EXIF `DateTimeOriginal` has no timezone, so `takenAt` is interpreted in your machine's timezone. It's only used for ordering.
- **Panos:** a 2:1 image (or GPano `ProjectionType=equirectangular`) is treated as 360°. `heading` for a pano is the compass direction of the image centre (`PoseHeadingDegrees` or `GPSImgDirection`).
