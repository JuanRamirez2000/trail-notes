# Trailnotes

Photo-by-photo trail guides. Each hike is an MDX guide with embedded map components; the route, turning points and view directions come from the EXIF data in your photos (GPS, timestamp, compass heading).

**Stack:** Next.js 16 (App Router) · Tailwind CSS v4 · MDX · Mapbox GL JS (via react-map-gl) · Photo Sphere Viewer · Turf · Zod · Zustand · Supabase (database, Auth, Storage)

```bash
pnpm install
cp .env.example .env.local   # add your Mapbox token
pnpm dev                     # http://localhost:3100
```

Maps render as a hand-drawn sketch until `NEXT_PUBLIC_MAPBOX_TOKEN` is set. Photos come from Supabase; to work offline, run `pnpm photos pull` once and set `NEXT_PUBLIC_PHOTO_STORAGE=local` (dev only).

```bash
pnpm test        # unit tests (Vitest)
pnpm lint
pnpm typecheck   # next typegen + tsc
pnpm build
```

CI (`.github/workflows/ci.yml`) runs `pnpm content check`, lint, typecheck, tests, `pnpm photos check` and `pnpm build` on every push and PR.

---

## How it fits together

```
~/photos/<hike>/*.jpg
   │  pnpm ingest <folder> --slug <slug>
   ▼
exifr (GPS · time · heading) → sort by time → fill headings (EXIF → bearing to next photo → blank)
   → sharp: webp 2400px + 480px thumb, all metadata stripped → Supabase (or /public/photos in dev)
   → content/hikes/<slug>/waypoints.json (draft) + index.mdx stub
   │  you review and edit (by hand or in /editor)
   ▼
Content store (src/lib/store): validates the guide + pins with the Zod schemas in src/lib/schemas.ts and compiles the MDX
   (files in content/hikes under `pnpm dev`; the Supabase database in production)
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
  import-gpx.ts        GPX → track.json
  photos.ts            check / push / pull photos between Supabase and public/photos
  content.ts           check guides against the save gate; copy guides files ↔ database
  editors.ts           the editors allow-list
  lib/                 pure helpers shared by the scripts (unit-tested)
  make-sample-photos.ts  placeholder JPEGs with real EXIF, for trying the pipeline
src/
  app/(site)/          gallery (/) and hike guide (/hikes/[slug])
  app/editor/          the editor (a local owner under `pnpm dev`; Google sign-in on the live site)
  app/api/editor/      create and save endpoints (404 for anyone who isn't an editor)
  app/robots.ts, sitemap.ts, error.tsx, not-found.tsx   crawler files and error pages
  proxy.ts             refreshes the sign-in session on editor routes
  components/mdx/      guide components + registry.tsx
  components/map/      TrailMap (Mapbox, lazy) + SketchMap fallback
  components/gallery/  filters, all-hikes map, cards
  components/sidebar/  the guide's sidebar cards
  components/editor/   Write, Details, Pins and Advanced views
  lib/store/           the content store: one interface over files and Supabase, with the save gate
  lib/auth/            who may edit (getEditor, can) and request guards
  lib/mdx/             component manifest, remark passes (no code, step sections, props), compile
  lib/schemas.ts       single source of truth for content shape
  lib/hike-store.tsx   per-page Zustand store (active step, 360° look direction)
  lib/storage.ts       photo key → URL (Supabase, or local in dev)
  app/globals.css      design tokens (Tailwind @theme) from the Claude Design handoff
supabase/migrations/   tables, row-level security and the save functions
```

---

## Adding a hike

**In the app:** open the editor, click **＋ New hike**, fill in the form and (optionally) choose a GPX recording. It creates a draft and opens it: place pins under **Pins**, write under **Write**, fill in the rest under **Details**, then **Publish**. Photos are still added from the command line (below), with `--guides supabase` if the site reads guides from the database.

**From photos, on the command line:**

1. **Export your photos as JPEG** (keep location metadata on). HEIC originals work for EXIF, but sharp's prebuilt binaries can't decode HEVC, so convert first.
2. **Run the ingest script:**

   ```bash
   pnpm ingest ~/Pictures/granite-lakes --slug granite-lakes
   ```

   This creates `content/hikes/granite-lakes/` with a `waypoints.json` draft and an `index.mdx` stub (`draft: true`), and uploads web-sized photos to Supabase. Useful flags: `--storage local` (write to `public/photos` instead; run `pnpm photos push` before deploying), `--dry-run` (read EXIF, write nothing) and `--force` (replace an existing `waypoints.json` instead of merging into it).

   **Adding photos to a hike that already has waypoints** (or a recorded track) merges them in: existing pins keep their ids and text, photos that were ingested before are skipped, and new ones get the next free `wp-NN` id. If the hike has a `track.json`, each photo is snapped onto the track (when it's within ~80 m) and slotted in by trail mileage, so an out-and-back resolves by capture time. Photos far from the track keep their GPS position and are listed, with a hint when one looks out of order rather than off-trail. It's fine to import the GPX first and add photos later.
3. **Review `waypoints.json`.** For each waypoint:
   - `id`: rename `wp-03` to something readable like `ridge-junction` (this is what MDX refers to)
   - `type`: `start | turn | note | viewpoint | landmark | water | ranger | bailout` (see *Guide sections* below)
   - `label` (short map label), `title` (step instruction), `caption`, `note` (for safety pins)
   - `heading`: check any with `"headingSource": "inferred"`, and fill the ones left `null` (then set `"headingSource": "manual"`)
   - `mile`: optional real trail mileage. Without it, mileage is estimated from straight lines between photos, which reads low.
   - `order` values have gaps of 10, so you can slot in extra waypoints.
4. **Write the guide** in `index.mdx`, fill in the frontmatter, and set `draft: false`. Drafts show in `pnpm dev` but not in production.
5. `pnpm dev` and check the page, or use the editor (below).

Invalid content (unknown waypoint type, a slug that doesn't match its folder, a bad photo key, a mistyped component prop…) is refused when it's saved and reported by `pnpm content check`, with a readable error. Guides can't contain code: no `import`/`export`, no `{…}` expressions, and no raw HTML beyond a few harmless tags.

### Guide sections

Every pin type declares how it relates to the written guide (`src/lib/pins.ts`):

| Pin | Section | Sidebar step list |
| --- | --- | --- |
| Trailhead `S`, Turn `↰`, Note `✎`, Bail-out `!` | **Required.** Write `<Step waypoint="id">…</Step>` for it; if you don't, a stub section (title, photo, caption) is generated in route order | Numbered |
| Viewpoint `◎`, Landmark `◆`, Water `W`, Ranger station `R` | **Optional.** Only appears if you write a `<Step>` for it | Not listed. Clicking the pin jumps to the nearest section before it |

`note` is the flex type: a required section for anything that isn't a turn (a slick slab, a confusing fork, no cell signal). To give it its own look later, change its entry in `PIN_STYLES`.

```mdx
<Step waypoint="creek-junction">
Your notes for this part of the trail. The step number, pin, mileage, photo and caption are added for you.
</Step>
```

A `<Step>` pointing at an unknown waypoint id, two `<Step>` blocks for the same waypoint, or a `<Step>` in the middle of a line is refused when the guide is saved (and by `pnpm content check`). The stub generator lives in `src/lib/mdx/remark-step-sections.ts`. Under `pnpm dev`, guides are read from the files on every request, so an edited `waypoints.json` or `track.json` shows on reload.

Water, ranger stations and bail-outs are the **safety** pins (larger, double halo). They make up the Safety points list and the `<SafetyPins />` map.

**Sidebar:** on desktop, the guide has a sticky rail: **Minimap → Safety points → Steps**. Clicking a step scrolls to its section, and as you scroll, the active step follows what you're reading. On mobile, the same list lives in the pinned minimap bar. To add more cards to the rail, append to `src/components/sidebar/registry.tsx`.

### Before you go

Optional `essentials` in the frontmatter render as a "Before you go" card. It comes first unless the guide places `<BeforeYouGo />` somewhere else:

```yaml
essentials:
  permit: Free self-issue permit at the guard station.
  parking: Gravel lot, ~25 cars. Full by 8 am on weekends.
  facilities: Vault toilet at the trailhead.
  water: Granite Creek (1.6 mi), Tarn Lake (5.0 mi).
  dogs: On leash.
  cellSignal: None until First Pass.
  hazards:
    - Loose rock on the scree traverse (mile 5.4).
```

### Components you can use in MDX

| Component | Props | What it does |
| --- | --- | --- |
| `<Step waypoint="id">…</Step>` | `hidePhoto` | A guide section for a pin (see above) |
| `<BeforeYouGo />` | | The "Before you go" card from the frontmatter `essentials`. If a guide doesn't place it, it goes first |
| `<RouteMap />` | `height`, `labels`, `terrain` | All pins + route line, 3D terrain, legend |
| `<SafetyPins />` | `height` | Water + bail-out layer, other pins faded |
| `<Minimap />` | `height` | Current step map (the page already puts one in the sticky rail) |
| `<SafetyPoints />` | | The sidebar's safety list, placed in the guide |
| `<Steps />` | | The sidebar's numbered step list, placed in the guide |
| `<StepByStep />` | `showMeta` | Inline step list with photos |
| `<PhotoCard waypoint="id" />` | `caption` | Photo linked to its pin (360° photos switch to the viewer) |
| `<PanoViewer waypoint="id" />` | `markerRadiusMi` | 360° viewer; the inset map cone follows where you look. Shows a "coming soon" placeholder until the waypoint has a 360° photo |

Props are checked at build time against `src/lib/mdx/manifest.ts`: an unknown component, an unknown or mistyped prop, an out-of-range number, content inside a component that takes none, or a pin id that isn't in `waypoints.json` fails the build with the line number. The editor refuses to save the same mistakes.

**Sidebar per guide:** the rail (and the mobile bar) shows `minimap`, `safety` and `steps` in that order by default. To reorder them or leave one out, list them in the frontmatter:

```yaml
sidebar: [steps, minimap]
```

### Adding a new component

1. Build the component inside `<Frame>` and read or write shared state with `useHike(...)`.
2. Describe its props in `src/lib/mdx/manifest.ts` (a zod object: `.describe()` is the field label, `waypointRef()` makes it a pin picker) and give it a title, category and snippet.
3. Add it to `src/components/mdx/registry.tsx`. Its props type comes from the manifest (`ManifestProps<"Name">`).

It then works in MDX, gets checked at build time, appears in the editor's insert menu under its category, and gets a settings form in the editor with no editor work.

---

## Recorded routes (GPX)

If you recorded the hike (Garmin, Strava, Gaia…), import the GPX so the maps draw the real route instead of straight lines between photos:

```bash
pnpm gpx ~/Downloads/activity.gpx --slug strawberry-peak
```

This writes `content/hikes/<slug>/track.json` and prints the distance, gain and trailhead to use in the frontmatter. Waypoint mileages are then measured along the recorded track, projected onto the nearest segment (an out-and-back resolves by waypoint `order`). Only latitude, longitude and elevation are kept: timestamps, heart rate, cadence and device data are dropped, so the track is safe to publish. A hike can have a track and no photos; `cover` is optional and falls back to a contour placeholder.

## The editor (`/editor`)

`pnpm dev`, then open http://localhost:3100/editor (a local owner, no sign-in; the dev server only listens on this machine, use `pnpm dev:lan` to reach it from a phone). On the live site the editor is behind Google sign-in, and only people on the editors list (`pnpm editors add <email>`) can open it; everyone else gets a 404.

One guide, four views:

- **Write** (default): the guide as a document. Text is edited in place and every component is a live block; click one to change its settings beside it. A guide that uses Markdown this view can't show (an image, a code block, a reference-style link, a footnote) is sent to Advanced instead of being shown cut short.
- **Details**: title, stats, "Before you go" and the sidebar order, as a form.
- **Pins**: the pins on a map (drag to move, drag the yellow dot to aim the photo, click to add), a list in route order and a form per pin.
- **Advanced**: the raw Markdown and pins JSON with a live preview.

Autosave runs 1.5 s after you stop typing (or press ⌘S), one save at a time. Every save passes the same gate as the scripts (schemas, MDX compile, no code) and nothing invalid is written. Each save names the version it was based on, so if the guide changed in the meantime (another tab, a script, another editor) the editor says so and writes nothing. Leaving the page with unsaved text asks first. Publish and Unpublish flip the guide's `draft` flag.

---

## Try the pipeline with sample photos

The sample hike (`ridgeline-loop`) was generated this way:

```bash
pnpm sample:photos [slug]   # placeholder JPEGs with GPS/time/heading EXIF → fixtures/sample-photos/<slug>/
pnpm ingest fixtures/sample-photos/ridgeline-loop --slug ridgeline-loop --force
```

`granite-saddle` is the detailed example: 18 pins covering every type, a full "Before you go" card, and a written section for each.

Re-running with `--force` overwrites the hand-edited `waypoints.json`; without it, already-ingested photos are skipped. Both samples are `draft: true`: they show in `pnpm dev` (and serve as reference content) but not in production. `strawberry-peak` is a real recorded route (GPX).

---

## Photo storage: Supabase

Supabase Storage is the source of truth for photos. `public/photos` is gitignored and only used by the dev-only `local` backend; production builds refuse to run without `NEXT_PUBLIC_PHOTO_STORAGE=supabase`.

1. Create a Supabase project. Nothing else is needed; the ingest script creates a public `hikes` bucket on first run.
2. In `.env.local`:

   ```bash
   NEXT_PUBLIC_PHOTO_STORAGE=supabase
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service role key>   # secret; used by the scripts and, with CONTENT_STORE=supabase, by the server
   ```

3. `pnpm ingest <folder> --slug <slug>` now uploads to `hikes/<slug>/...`.

```bash
pnpm photos check         # every photo the content references is in the bucket (no key needed; CI runs it)
pnpm photos push [slug]   # upload public/photos → bucket (skips existing files)
pnpm photos pull [slug]   # download bucket → public/photos, for offline dev
```

Only the two web-sized, metadata-free webp copies are uploaded. Your originals (with exact GPS) never leave your machine. The site builds public URLs from the photo key, so moving storage later is a one-file change in `src/lib/storage.ts`.

---

## Deploying to Vercel

1. Push the repo to GitHub, then **Add New → Project** on Vercel and import it. The framework preset is detected, and `pnpm build` (`next build`) is the build command.
2. Add environment variables (Production + Preview):
   - `NEXT_PUBLIC_MAPBOX_TOKEN`
   - `NEXT_PUBLIC_PHOTO_STORAGE=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_BUCKET` (required: the build fails without them)
   - To serve guides from the database and open the editor on the live site, also add `CONTENT_STORE=supabase`, `EDITOR_AUTH=supabase`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (**Sensitive**, never `NEXT_PUBLIC_`). The full steps, including Google sign-in, are in [docs/knowledge/e2-go-live.md](docs/knowledge/e2-go-live.md). Without them the site reads the guides committed in `content/hikes` and the editor is closed.
   - Optional: `NEXT_PUBLIC_SITE_URL` once the site has its own domain (the sitemap and social cards use it; it defaults to the project's production domain).
3. In your Mapbox account, add the Vercel domain(s) to the token's URL restrictions.
4. Deploy. Hike pages are rendered once and cached. With guides in files, adding a hike means committing its folder and pushing; with guides in the database, a saved guide is live within seconds and needs no deploy.

With the CLI: `npm i -g vercel`, `vercel link`, `vercel env add NEXT_PUBLIC_MAPBOX_TOKEN`, then `vercel --prod`.

---

## Notes

- **Backlog:** unscheduled feature ideas live in [docs/knowledge/backlog.md](docs/knowledge/backlog.md).

- **Mapbox costs:** each map counts as a map load. Maps only mount when scrolled near the viewport, and the small inset maps skip 3D terrain. The free tier is 50k loads/month.
- **Timestamps:** a photo's capture time is only used to put the photos in order during `pnpm ingest`. It is never stored or published.
- **Panos:** a 2:1 image (or GPano `ProjectionType=equirectangular`) is treated as 360°. `heading` for a pano is the compass direction of the image centre (`PoseHeadingDegrees` or `GPSImgDirection`).
