# Current state

_Last updated 2026-10-05. Version: **V1 shipped** (commit `aa9298f`); **V2 (editing)** in progress: E0 and E1 done. Next is **E2: guides move from files to Supabase, with sign-in and guardrails** (owner decision, 2026-10-05), before any more editor features. Until E2.3 ships, everything below about files and Velite is still how the live site works. See [v2-plan.md](v2-plan.md)._

Trailnotes is a photo-by-photo hiking guide site. Each hike is an MDX guide whose route, turning points and view directions come from a GPS recording (GPX) and the EXIF data of the hiker's photos.

- **Live:** https://trail-notes-amber.vercel.app. Every push to `main` deploys to production.
- **Repo:** github.com/JuanRamirez2000/trail-notes (public). Work happens directly on `main`, by the owner's choice, so every commit must build and pass CI.
- **Vercel:** project `prj_BRkSr8pDopFEqEJGNNNtKhUOaPwl`, team `team_xA3s7AnPMr8p1ZVJafHQupxT`. Use the claude.ai Vercel connector; the plugin connector returns 403 on this team.
- **Supabase:** project `fstcgdirhssuaevgxptv` ("trail-notes", us-east-2, Postgres 17, **free plan**: pauses after about a week idle). Today: the public bucket `hikes` (photos only) and no tables. V2 E2 adds the guides, sign-in and an editors list.
- **Design source:** Claude Design project `87e465cf-146d-4327-9930-d7562360f28b`. *Trail Guide Branded.dc.html* has the screens: 1 gallery, 2 guide page, 3a authoring view, 4a component sheet. It's readable from a session with the `DesignSync` tool (`list_files` / `get_file`) when the owner asks for it; inline styles map 1:1 onto the tokens in `globals.css`.

## Baseline hike: Strawberry Peak

`content/hikes/strawberry-peak` is the reference for all new work: features, the editor, tests and demos. It's the only published hike, and the only one built from real data:

- `track.json` from a Garmin GPX (2026-04-19): 7.31 mi, 1,830 ft gain, out-and-back from Red Box to a 6,140 ft summit.
- 6 pins, each at a point where the recording changes character, with one photo per pin (6 of the 19 taken; see [backlog.md](backlog.md) for how they were picked): Red Box (start, 0.0 mi), mountain curve (1.1), saddle (2.4), rocky climb (2.8), steepest pitch (3.4), summit (3.6). Every pin is a `note`, except the trailhead.
- Captions and the "Before you go" card were written from the recording's grades, elevations and pace. The original photos are in the owner's `~/Downloads/straberry/` (HEIC); the GPX is `~/Downloads/activity_22587017513.gpx`. Both are local only, never committed.

`ridgeline-loop` and `granite-saddle` are `draft: true` samples (placeholder photos, made-up routes). They only show under `pnpm dev`. Keep them as fixtures: `granite-saddle` exercises every pin type and section rule.

## Architecture

```
content/hikes/<slug>/{index.mdx, waypoints.json, track.json?}
   │  Velite (velite.config.ts), validated by the zod schemas in src/lib/schemas.ts
   ▼
.velite/ → src/lib/content.ts → /hikes/[slug] (static) → MDX rendered with src/components/mdx/registry.tsx
                                                      → <HikeProvider> per-page zustand store (src/lib/hike-store.tsx)
```

- **Stack:** Next.js 16.3 App Router (breaking changes vs. older Next: read `node_modules/next/dist/docs` first), React 19.2, Tailwind v4 with brand tokens in `src/app/globals.css` (never hardcode hex in components), Velite 0.4, zod 4, Mapbox GL 3 through react-map-gl 8, Vitest 5, pnpm 11, Node 24 in CI.
- **Schemas are the single source of truth** (`src/lib/schemas.ts`), shared by the Velite build, the scripts and the editor's save API.
- **Pins and guide sections** (`src/lib/pins.ts`): `start/turn/note/bailout` require a section and are numbered steps; if the MDX has no `<Step>` for one, `src/lib/mdx/remark-step-sections.ts` inserts a stub in route order. `viewpoint/landmark/water/ranger` are optional. The safety pins are `water/ranger/bailout`.
- **Component manifest:** `src/lib/mdx/manifest.ts` (pure zod, no React) defines every MDX component's props, title, category, snippet and whether it takes content. `src/components/mdx/registry.tsx` maps each name to its React component, and the components take their prop types from the manifest (`ManifestProps<"Name">`). Everything else reads the manifest: build-time prop checks, the editor's settings forms, the insert menu and MDXEditor's block descriptors.
- **Remark passes, in order** (identical in `velite.config.ts`, the editor preview `src/components/editor/compile.ts` and the save gate `src/lib/mdx/check.ts`):
  1. `remark-step-sections`: stub `<Step auto>` for required pins.
  2. `remark-default-blocks`: `<BeforeYouGo auto />` first if the guide doesn't place it.
  3. `remark-component-props`: unknown components and props, types and ranges, no-content components, pin references.
- **Movable blocks:** "Before you go", the safety list and the step list are MDX components (`<BeforeYouGo />`, `<SafetyPoints />`, `<Steps />`). The guide's sidebar order comes from the frontmatter `sidebar` (ids in `SIDEBAR_CARDS`, `src/lib/schemas.ts`; cards in `src/components/sidebar/registry.tsx`); the mobile bar follows it.
- **Track math** (`src/lib/track.ts`): projects points onto track segments, searching forward from the previous point so out-and-backs resolve by route order. The match slack scales with the distance from the track. Page mileages (`src/lib/hike.ts`) and ingest both use it.
- **Maps:** `TrailMap` → lazy `MapboxTrailMap`, with `SketchMap` (SVG) as the base layer and fallback. Maps mount only near the viewport and use a pool (`reuseMaps`) to stay under the browser's WebGL context limit. Pins are memoised `WaypointMarker`s.
- **Photos:** Supabase Storage is the source of truth: `<slug>/<NN>-<name>.{full,thumb}.webp`, with all metadata stripped. `public/photos` is a gitignored, dev-only backend (`NEXT_PUBLIC_PHOTO_STORAGE=local`). Production builds refuse it (guard in `next.config.ts`).
- **Editor** (`/editor`, `src/components/editor/`): local only (pages and the save API return 404 unless `NODE_ENV=development`).
  - CodeMirror for `index.mdx` and the raw `waypoints.json`.
  - A live preview compiled in the browser with the same remark passes, given `track.json` and `essentials`.
  - Layout per design 3a: Markdown · live preview · a fixed 290px settings column.
  - A settings panel for the component under the cursor or clicked in the preview (`ComponentSettings.tsx` + `jsx-source.ts`, which rewrites only the opening tag through a CodeMirror transaction; `remark-source-markers.ts` makes preview blocks selectable), with Duplicate and Remove.
  - An insert menu grouped by category, and autosave after 1.5 s.
  - Saves are validated like a build (schemas + MDX compile) before anything is written (`src/lib/editor-fs.ts`, `src/app/api/editor/[slug]/route.ts`).
  - MDXEditor (`mdx-editor-config.ts`) is installed for the Write mode (V2 E3); only the tests use it so far.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server on **port 3100** (3000 is taken by another project on the owner's machine). `/editor` only exists here; it's a 404 on the live site until V2 E2.5 (the editor in production). Also starts Velite's watcher, and touches `index.mdx` when a sibling `waypoints.json`/`track.json` changes |
| `pnpm test` | Vitest (98 tests: remark passes and prop checks, manifest, schemas, geo, track, ingest/GPX helpers, editor source helpers, MDXEditor round trip on jsdom) |
| `pnpm typecheck` | `velite build --strict && next typegen && tsc --noEmit` |
| `pnpm build` | `velite build --strict && next build` |
| `pnpm ingest <folder> --slug <slug>` | EXIF → waypoints. Merges into existing waypoints and snaps to the track; `--force` replaces; `--storage local` writes to `public/photos` |
| `pnpm gpx <file.gpx> --slug <slug>` | GPX → `track.json` (lat/lng/elevation only) |
| `pnpm photos check\|push\|pull [slug]` | Photos referenced by content exist in Supabase (CI runs this) / upload local photos / download for offline dev |

CI (`.github/workflows/ci.yml`) runs content, lint, typecheck, tests, `photos check` and build on every push and PR. No secrets are needed: the Supabase URL is public.

## Decisions (and why)

- **Commit straight to `main`.** It's the owner's choice, so CI and a local `pnpm build` are the safety net.
- **Pins come from the GPX, photos illustrate them.** Owner, 2026-10-01: not every photo becomes a node. Use one photo per stretch of trail, and no two pins showing the same view. Several photos per point is planned for v3/v4.
- **Timestamps stay private.** `track.json` keeps only `[lng, lat, ele]`. Pace and stop analysis uses the local GPX; only derived facts (grades, "pace drops 3–4×") go into published text.
- **Scroll performance (2026-09-30):** measured on a production build in headless Chrome: about 3% dropped frames and about 16 ms p95 scroll latency. An IntersectionObserver scrollspy, mount hysteresis and deferred map camera moves showed no measurable gain, so they were dropped. Reproduce on the reported page before optimising again.

## Gotchas

- **Next 16.3 evaluates `next.config.ts` in a child process** whose argv lacks `dev`. Detect dev with `process.env.NODE_ENV === "development"`; an argv check silently disabled Velite's watcher.
- **Next generates the `PageProps`/`LayoutProps`/`RouteContext` globals.** Run `next typegen` before `tsc` on a fresh checkout (`pnpm typecheck` does this).
- **Only one `next dev` per folder.** Next 16 refuses a second one. Orphaned servers from earlier sessions have been found on ports 3100/3101.
- **The in-app browser pane can't render while hidden.** No screenshots, and Mapbox doesn't initialise. For visual checks and profiling, use `playwright-core` with system Chrome from the session scratchpad. Never add it to the repo.
- **Mapbox:** the token is URL-restricted, so some tiles return 403 on `localhost`. Every map registers non-passive `wheel`/`touchmove` listeners (Mapbox internals, even with `interactive: false`).
- **iPhone photos:** files dragged out of Photos are tiny previews (`…_4_5005_c.jpeg`, 360–1024 px). Use File → Export, or the original HEIC. Convert HEIC with `sips -s format jpeg` (keeps GPS and heading, writes upright pixels with a normal orientation tag). sharp's prebuilt binary can't decode HEIC.
- **A perceptual hash (dHash) doesn't detect "same vista" duplicates** when the framing differs. Compare heading and content.
- **Structural typing won't catch a manifest prop that a component ignores.** Components take their prop types from the manifest to keep one definition, but nothing forces them to use every prop.
- **Guide pages run compiled MDX as code** (`new Function` in `src/components/mdx/MDXContent.tsx`), and the save gate doesn't yet refuse MDX `import`/`export` or `{…}` expressions. Safe while only the owner edits local files; it must be closed before saves can come from the live site (V2 E2.1).
- **`propFields` reads `z.toJSONSchema(..., { io: "input" })`.** Custom `.meta()` keys (`input`, `internal`) come through as JSON Schema keys; `.describe()` becomes `description`.
