# Trailnotes

Photo-by-photo trail guides. Each guide follows one hike with a photo at every point where the trail changes, pinned on the map where it was taken. The route comes from a GPS recording, and the pins and view directions come from the photos' own data (GPS position and compass heading).

Live: https://trail-notes-amber.vercel.app

Guides are written in the site's own editor: create a hike, drop in its photos, write, publish. Everything the editor does can also be done with files and scripts on your machine.

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · MDX · Mapbox GL JS (react-map-gl) · Photo Sphere Viewer · Zod · Zustand · Drizzle over Postgres · Supabase (database, sign-in, photo storage) · lucide icons

```bash
pnpm install
cp .env.example .env.local   # add your Mapbox token
pnpm dev                     # http://localhost:3100
```

Real guides live in the database, not in this repo. With nothing else set, `pnpm dev` keeps guides as files in `content/hikes` (a gitignored folder that starts empty), and http://localhost:3100/editor opens without a sign-in (the dev server listens on this machine only), so you can create a hike straight away. To browse the made-up test guides instead, run `CONTENT_DIR=fixtures/hikes pnpm dev`; to work on copies of the real ones, `pnpm content pull`. Maps render as a hand-drawn sketch until `NEXT_PUBLIC_MAPBOX_TOKEN` is set. Photos come from Supabase; to keep them on disk instead, set `NEXT_PUBLIC_PHOTO_STORAGE=local` (dev only) and run `pnpm photos pull` once.

```bash
pnpm test        # unit tests (Vitest)
pnpm lint
pnpm typecheck   # next typegen + tsc
pnpm build       # needs guides to build on: CONTENT_DIR=fixtures/hikes, or the database variables
pnpm e2e         # end-to-end tests (Playwright); builds the site on the fixture guides first
```

CI (`.github/workflows/ci.yml`) runs all of these, plus `pnpm content check`, on every push and pull request, on the fixtures in `fixtures/`.

---

## Writing a guide in the editor

Open `/editor`. Under `pnpm dev` you're a local owner. On the live site the editor is behind Google sign-in and only people on the editors list can open it; everyone else gets a 404.

1. **＋ New hike.** Fill in the form and, if you recorded the hike (Garmin, Strava, Gaia…), choose its GPX file. The file is read in your browser and only latitude, longitude and elevation are sent, so times and heart rate never leave your device. This creates a draft.
2. **Pins → Add photos** (or drop the files anywhere on the Pins view). Each photo is resized in your browser, uploaded, and becomes a pin where it was taken:
   - Only the resized image is uploaded. Re-encoding removes the location, time and camera data from the file; the position and direction are kept as the pin.
   - Photos are pinned in the order they were taken and, when the hike has a recorded track, snapped onto it and slotted in by trail mileage.
   - A photo with no compass heading gets one guessed from where the next photo was taken, marked **check direction** until you aim it.
   - A photo with no GPS position waits under **Unplaced**: drag it onto the map, or choose **Place** and click the map.
   - HEIC photos only work in a browser that can read them (Safari should; Chrome and Firefox can't). Elsewhere, export as JPEG first. On an iPhone, the photo picker has an **Options** menu that can strip the location; leave it on.
3. **Tidy the pins.** Drag a pin to move it, drag the yellow dot to aim the photo, and use the form to set each pin's type, label and section title. A photo taken off a pin goes back to Unplaced, where it can be deleted.
4. **Write.** The guide is a document: type text, and insert blocks (maps, the elevation profile, photo cards…) from **＋ Insert block**. Click a block to change its settings, move it up or down, or remove it.
5. **Details.** Title, stats, the "Before you go" card and the sidebar order.
6. **Publish.** Until then the guide is a draft with no public page. After publishing, edits are saved to a working copy and the public page changes only when you press **Publish changes**.

The editor's five views are the same guide seen five ways:

| View | What it's for |
| --- | --- |
| **Write** | The guide as a document, with every block live. A guide that uses Markdown this view can't show (an image, a code block, a footnote) is sent to Advanced instead of being shown cut short |
| **Details** | The guide's details as a form |
| **Pins** | Pins on a map, a list in route order, a form per pin, and photos |
| **Advanced** | The raw Markdown and pins JSON, with a live preview |
| **History** | Every saved version, with who saved it; restoring one makes it the newest version |

Saving is automatic, 1.5 s after you stop typing. Every save passes the same checks as the scripts, and nothing invalid is written. Each save names the version it was based on, so if the guide changed in the meantime (another tab, another editor) the editor says so and writes nothing.

What a published guide gets without any extra work: a page at `/hikes/<slug>`, a GPX download of the route and pins (`/hikes/<slug>/route.gpx`, no times in it), photos that open full size, a social card image made from the cover, and a place in the gallery, the sitemap and the landing page.

---

## How it fits together

```
In the editor                                   On the command line
─────────────                                   ───────────────────
photos dropped in Pins                          pnpm ingest <folder> --slug <slug>
  │ browser: read EXIF, resize, re-encode         │ Node: read EXIF, resize with sharp
  │ upload straight to storage                    │ upload (or write to public/photos)
  ▼                                               ▼
        the same rules (src/lib/ingest.ts): capture order, heading
        from EXIF or the next photo, snap to the track, one pin per photo
                              │
                              ▼
Content store (src/lib/store): checks every save against the schemas in
src/lib/schemas.ts, compiles the MDX, refuses code and stale versions
   files in content/hikes (default)  ·  Postgres through Drizzle (the live site)
                              │  Publish copies the working copy to the published copy
                              ▼
/hikes/[slug] (cached) → MDX rendered with the component registry
   → one <HikeProvider> store shared by the maps, step lists, photos and elevation profile
```

```
content/hikes/<slug>/      guides as files, on your machine only (gitignored): index.mdx, waypoints.json (the pins), track.json, published/
fixtures/                  invented guides and photos for the tests (make-fixture-guide), and sample JPEGs with EXIF
scripts/                   ingest-photos, import-gpx, photos, content, editors, make-icons, make-sample-photos
src/
  app/(site)/              landing page (/), gallery (/hikes), guide (/hikes/[slug], with route.gpx and og.jpg)
  app/editor/              the editor
  app/api/editor/          create, save, publish, history and photo routes (404 for anyone who isn't an editor)
  proxy.ts                 refreshes the sign-in session on editor routes
  components/mdx/          guide components, registry.tsx, icons.ts
  components/map/          TrailMap (Mapbox, loaded when near the viewport) with SketchMap underneath
  components/editor/       Write, Details, Pins, Advanced and History views
  components/sidebar/      the guide's sidebar cards
  lib/store/               the content store: one interface over files and Postgres
  lib/auth/                who may edit (getEditor, can) and request guards
  lib/mdx/                 component manifest, remark passes (no code, step sections, props), compile
  lib/ingest.ts            photos into pins, shared by the editor and pnpm ingest
  lib/photo-store.ts       the server's side of photo storage (upload URLs, listing, deleting)
  lib/schemas.ts           single source of truth for content shape
  lib/hike-store.tsx       per-page store (active step, open photo, 360° look direction)
  db/                      the database tables in TypeScript (Drizzle)
drizzle/                   migrations (`pnpm db:generate`, `pnpm db:migrate`)
docs/knowledge/            the project's current state, changelog, TODOs and plans
```

`docs/knowledge/current.md` is the detailed description of how everything works today, including the decisions and gotchas the code doesn't explain.

---

## Pins and guide sections

Every pin has a type, and the type decides how it relates to the written guide (`src/lib/pins.ts`):

| Pin | Section | Sidebar step list |
| --- | --- | --- |
| Trailhead `S`, Turn `↰`, Note `✎`, Bail-out `!` | **Required.** If you don't write one, a section with the pin's title, photo and caption is generated in route order | Numbered |
| Viewpoint `◎`, Landmark `◆`, Water `W`, Ranger station `R` | **Optional.** Only appears if you write one | Not listed. Clicking the pin jumps to the nearest section before it |

`note` is the flexible type: a required section for anything that isn't a turn (a slick slab, a confusing fork, no cell signal). Water, ranger stations and bail-outs are the **safety** pins (larger, double halo); they make up the Safety points list and the `<SafetyPins />` map.

In the Write view, pins without a written section are listed above the document with a **Write this section** button. In Markdown a section is:

```mdx
<Step waypoint="creek-junction">
Your notes for this part of the trail. The step number, pin, mileage, photo and caption are added for you.
</Step>
```

A `<Step>` pointing at a pin that doesn't exist, two for the same pin, or one in the middle of a line is refused when the guide is saved.

**Sidebar:** on a wide screen the guide has a sticky rail: **Minimap → Safety points → Steps**. Clicking a step scrolls to its section, and the active step follows what you're reading. On a phone the same cards live in a bar pinned to the top. The order is set under Details (in the frontmatter, `sidebar: [steps, minimap]`), and a card left out isn't shown.

### Blocks

| Block | Settings | What it does |
| --- | --- | --- |
| `<Step waypoint="id">…</Step>` | `hidePhoto` | A guide section for a pin |
| `<BeforeYouGo />` | | Permit, parking, water and hazards from the guide's details. Comes first unless you place it |
| `<RouteMap />` | `height`, `labels`, `terrain` | All pins and the route line, 3D terrain, legend |
| `<SafetyPins />` | `height` | Water and bail-out pins, the others faded |
| `<Minimap />` | `height` | A small map that follows the current step (the page already has one in the rail) |
| `<ElevationProfile />` | `height` | The climb along the recorded track, with the pins on it |
| `<GpxDownload />` | | A button to download the route and pins |
| `<SafetyPoints />` | | The sidebar's safety list, placed in the guide |
| `<Steps />` | | The sidebar's numbered step list, placed in the guide |
| `<StepByStep />` | `showMeta` | An inline step list with photos |
| `<PhotoCard waypoint="id" />` | `caption` | A photo linked to its pin (360° photos switch to the viewer) |
| `<PanoViewer waypoint="id" />` | `markerRadiusMi` | 360° viewer; the inset map's cone follows where you look |

Settings are checked against `src/lib/mdx/manifest.ts` on every save: an unknown block, an unknown or mistyped setting, an out-of-range number, text inside a block that takes none, or a pin id that doesn't exist is refused with the line number. Guides can't contain code: no `import`/`export`, no `{…}` expressions, and no raw HTML beyond a few harmless tags.

### Adding a new block

1. Build the component inside `<Frame>` and read or write shared state with `useHike(...)`.
2. Describe its settings in `src/lib/mdx/manifest.ts` (a zod object: `.describe()` is the field label, `waypointRef()` makes it a pin picker) and give it a title, category and snippet.
3. Add it to `src/components/mdx/registry.tsx` and give it an icon in `src/components/mdx/icons.ts`. Its props type comes from the manifest (`ManifestProps<"Name">`).

It then works in guides, is checked on save, appears in the editor's insert menu with its icon, and gets a settings form, with no editor work.

---

## Working with files and scripts

Everything above also works without the editor, on guides kept as files in `content/hikes` on your machine (nothing there is committed). Add `--guides postgres` to write to the database instead (it needs `DATABASE_URL`).

```bash
pnpm gpx ~/Downloads/activity.gpx --slug granite-lakes     # the recorded route; creates a draft on a new slug
pnpm ingest ~/Pictures/granite-lakes --slug granite-lakes  # photos → pins
```

- **`pnpm gpx`** keeps only latitude, longitude and elevation and prints the distance, gain and trailhead to use in the details. Pin mileages are then measured along the track (an out-and-back resolves by route order).
- **`pnpm ingest`** follows the same rules as the editor's upload. Photos without GPS are skipped. Run again on the same folder, it merges: existing pins keep their ids and text, and photos already added are skipped. `--storage local` writes photos to `public/photos` instead of Supabase, `--dry-run` writes nothing, and `--force` replaces the hike's pins instead of merging. sharp can't decode HEIC, so convert those to JPEG first (`sips -s format jpeg`).
- **Review `waypoints.json`:** rename ids like `wp-03` to something readable (`ridge-junction`), set each pin's `type`, `label`, `title` and `caption`, and check any `"headingSource": "inferred"`. `order` has gaps of 10 so pins can be slotted in.
- **Write** `index.mdx`, then publish from the editor (with files, that copies the guide to `published/`). `pnpm dev` shows every guide's working copy; a production build shows only published copies.

```bash
pnpm content check [--store postgres]        # every guide passes the save checks
pnpm content seed [slug] [--force]           # copy guides: files → database
pnpm content pull [slug]                     # copy guides: database → files
pnpm photos check | push [slug] | pull [slug]   # published guides' photos exist / upload local photos / download for offline dev
pnpm editors list | add <email> | remove <email>   # who may use the editor on the live site
pnpm sample:photos [slug]                    # placeholder JPEGs with real EXIF, for trying the pipeline
pnpm icons                                   # rerender favicon.ico and apple-icon.png from src/app/icon.svg
```

The guides in `fixtures/hikes` are invented, for the tests: `cedar-ridge` is published, with a track and six photos, and `ridgeline-loop` and `granite-saddle` are drafts (`granite-saddle` uses every pin type).

---

## Photos and storage

Supabase Storage holds the photos, in a public bucket (`hikes`) that accepts webp only: two files per photo, `<slug>/<NN>-<name>.full.webp` (2400 px) and `.thumb.webp` (480 px), with no metadata. Your originals never leave your machine.

- **From the editor**, the server works as the signed-in editor: the bucket's policies let people on the editors list add, list and delete photos, and nobody else. The browser uploads straight to Supabase through short-lived signed URLs. The site holds no admin key.
- **From the scripts** (`pnpm ingest --storage supabase`, `pnpm photos push|pull`), uploads use `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`. It bypasses every rule, so it stays on your machine.
- **Deleting** a photo is only possible from Unplaced in the editor, and the server refuses while the saved guide or the published page still uses it. Deleting a draft removes its photos.
- **`public/photos`** is a gitignored, dev-only stand-in (`NEXT_PUBLIC_PHOTO_STORAGE=local`). Production builds refuse it.

---

## Running your own

1. **Supabase.** Create a project. `pnpm db:migrate` (with `DATABASE_URL` in `.env.local`) creates the tables, the "server only" rules on them, and the bucket's policies. The `hikes` bucket itself is created by the first `pnpm ingest --storage supabase`.
2. **Vercel.** Import the repo; the framework preset is detected. Environment variables:
   - `NEXT_PUBLIC_MAPBOX_TOKEN` (a public `pk.` token, restricted to your domains)
   - `NEXT_PUBLIC_PHOTO_STORAGE=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_BUCKET` (the build fails without them)
   - For guides in the database and the editor on the live site: `CONTENT_STORE=postgres`, `DATABASE_URL` (the transaction pooler's connection string; **Sensitive**, never `NEXT_PUBLIC_`), `EDITOR_AUTH=supabase` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Optional: `NEXT_PUBLIC_SITE_URL` once the site has its own domain
3. **Sign-in.** Google sign-in through Supabase Auth, and `pnpm editors add <email>` for each editor. The steps are in [docs/knowledge/current.md](docs/knowledge/current.md#live-setup-sign-in-and-the-database).

A deployment needs the database variables: no guides are committed to the repo. A published guide is live within seconds and needs no deploy. `.env.example` describes every variable.

---

## Notes

- **Privacy:** a photo's capture time only orders a batch and is never stored; tracks keep no times either. Position plus time would give away pace.
- **Mapbox costs:** each map counts as a map load. Maps only mount when scrolled near the viewport, with the sketch map underneath until they've painted. The free tier is 50k loads a month.
- **360° photos:** a 2:1 image (or one marked `ProjectionType=equirectangular`) is treated as 360°. Its `heading` is the compass direction of the image centre.
- **Licence:** MIT for the code (`LICENSE`). The guides and photos are all rights reserved.
- **Where things are going:** [docs/knowledge/](docs/knowledge/) has the changelog, the TODO list and the backlog.
