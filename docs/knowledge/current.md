# Current state

_Last updated 2026-10-05. Version: **V1 shipped** (commit `aa9298f`); **V2 (editing)** in progress: E0 and E1 done. **E2 (guides in Supabase, sign-in, guardrails) is built and deployed but switched off on the live site,** which still reads guides from files and keeps its editor closed until the owner adds keys and settings: see [e2-go-live.md](e2-go-live.md). Plan: [v2-plan.md](v2-plan.md)._

Trailnotes is a photo-by-photo hiking guide site. Each hike is an MDX guide whose route, turning points and view directions come from a GPS recording (GPX) and the EXIF data of the hiker's photos.

- **Live:** https://trail-notes-amber.vercel.app. Every push to `main` deploys to production.
- **Repo:** github.com/JuanRamirez2000/trail-notes (public). Work happens directly on `main`, by the owner's choice, so every commit must build and pass CI.
- **Vercel:** project `prj_BRkSr8pDopFEqEJGNNNtKhUOaPwl`, team `team_xA3s7AnPMr8p1ZVJafHQupxT`. Use the claude.ai Vercel connector; the plugin connector returns 403 on this team.
- **Supabase:** project `fstcgdirhssuaevgxptv` ("trail-notes", us-east-2, Postgres 17, **free plan**: pauses after about a week idle).
  - Storage: the public bucket `hikes` (photos).
  - Tables `hikes`, `hike_revisions`, `editors` (migrations in `supabase/migrations/`, applied with the Supabase connector). Row-level security is on with explicit "server only" policies: the public key and signed-in browser sessions can read and write nothing; only the server's service-role key can.
  - The three guides are seeded. Auth (Google) is not configured yet.
- **Design source:** Claude Design project `87e465cf-146d-4327-9930-d7562360f28b`. *Trail Guide Branded.dc.html* has the screens: 1 gallery, 2 guide page, 3a authoring view, 4a component sheet. It's readable from a session with the `DesignSync` tool (`list_files` / `get_file`) when the owner asks for it; inline styles map 1:1 onto the tokens in `globals.css`.

## Baseline hike: Strawberry Peak

`content/hikes/strawberry-peak` is the reference for all new work: features, the editor, tests and demos (the store's contract tests use it as their fixture). It's the only published hike, and the only one built from real data:

- `track.json` from a Garmin GPX (2026-04-19): 7.31 mi, 1,830 ft gain, out-and-back from Red Box to a 6,140 ft summit.
- 6 pins, each at a point where the recording changes character, with one photo per pin (6 of the 19 taken; see [backlog.md](backlog.md) for how they were picked): Red Box (start, 0.0 mi), mountain curve (1.1), saddle (2.4), rocky climb (2.8), steepest pitch (3.4), summit (3.6). Every pin is a `note`, except the trailhead.
- Captions and the "Before you go" card were written from the recording's grades, elevations and pace. The original photos are in the owner's `~/Downloads/straberry/` (HEIC); the GPX is `~/Downloads/activity_22587017513.gpx`. Both are local only, never committed.

`ridgeline-loop` and `granite-saddle` are `draft: true` samples (placeholder photos, made-up routes). They only show under `pnpm dev`. Keep them as fixtures: `granite-saddle` exercises every pin type and section rule.

## Architecture

```
ContentStore (src/lib/store)                      one interface: list, read, save, create, setStatus, setTrack
  ├─ local backend     content/hikes/<slug>/{index.mdx, waypoints.json, track.json?}   CONTENT_STORE unset (default)
  └─ supabase backend  tables hikes / hike_revisions                                    CONTENT_STORE=supabase
        ▲ every write: validateHike (zod schemas + MDX compile + no code), then a version check
        │
src/lib/content.ts ── read ──► compileGuide (server, src/lib/mdx/compile.ts) ──► /hikes/[slug], cached
/editor + /api/editor/[slug] ── getEditor() + can() ──► store.save ──► revalidatePath
scripts (ingest, gpx, content, editors) ── scripts/lib/stores.ts ──► the same store
```

- **Stack:** Next.js 16.3 App Router (breaking changes vs. older Next: read `node_modules/next/dist/docs` first; `middleware` is now `proxy`), React 19.2, Tailwind v4 with brand tokens in `src/app/globals.css` (never hardcode hex in components), zod 4, `@mdx-js/mdx` 3, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Mapbox GL 3 through react-map-gl 8, Vitest 5, pnpm 11, Node 24 in CI. The package is `"type": "module"`. Velite was removed on 2026-10-05.
- **Schemas are the single source of truth** (`src/lib/schemas.ts`), shared by the save gate, the scripts and the editor.
- **Content store** (`src/lib/store/`):
  - `types.ts` is the interface. `store.ts` (`createStore(backend)`) holds all the rules once: nothing reaches a backend without `validateHike`, every change names the version it's based on and a stale one is refused, and status (draft/published) follows the guide's `draft` flag so files and database agree.
  - Backends only read and write raw records: `local.ts` (version = hash of the files; an invalid hand-edited guide is still readable, flagged `details: null`) and `supabase.ts` (version = integer column; `save_hike` / `create_hike` database functions update and write the history row in one transaction).
  - `server.ts` (`getStore()`, `server-only`) picks by `CONTENT_STORE`. It is explicit, not "is a key present", so a missing key is a loud error.
  - Pins are stored exactly as written (validated, not rewritten); the database columns are `json`, not `jsonb`, because jsonb reorders keys.
- **Rendering:** `src/lib/content.ts` reads through the store and compiles MDX on the server (`compileGuide`). `/` and `/hikes/[slug]` are static with `revalidate = 3600` and `dynamicParams = true`: refreshed when the editor saves (`revalidatePath`), hourly as a safety net, and a failed refresh keeps the last good page. Drafts show only under `pnpm dev`. `content/hikes` ships in the server bundle (`outputFileTracingIncludes`), and a missing folder is an error rather than "no hikes".
- **Identity** (`src/lib/auth/`): `getEditor()` (`server.ts`) and `can()` (`can.ts`) are the only access checks, always on the server. `EDITOR_AUTH` picks the mode: unset = a fixed local owner under `pnpm dev`, nobody anywhere else; `supabase` = Google sign-in through Supabase Auth, and only users in the `editors` table count; `off` = nobody. Routes: `/sign-in`, `/auth/sign-in`, `/auth/callback` (signs a non-editor straight back out), `/auth/sign-out`; `src/proxy.ts` refreshes the session for editor routes only. Outsiders get a 404 everywhere.
- **Save route** (`src/app/api/editor/[slug]/route.ts`), in order: editor check, same-origin, size and rate limits (`src/lib/auth/request.ts`), then the store (validation, version), then `revalidatePath`. Conflicts are 409, invalid content 422.
- **Keep-alive:** `vercel.json` runs `/api/health` daily; with the Supabase store it reads from the database so the free-plan project doesn't pause.
- **Pins and guide sections** (`src/lib/pins.ts`): `start/turn/note/bailout` require a section and are numbered steps; if the MDX has no `<Step>` for one, `src/lib/mdx/remark-step-sections.ts` inserts a stub in route order. `viewpoint/landmark/water/ranger` are optional. The safety pins are `water/ranger/bailout`.
- **Component manifest:** `src/lib/mdx/manifest.ts` (pure zod, no React) defines every MDX component's props, title, category, snippet and whether it takes content. `src/components/mdx/registry.tsx` maps each name to its React component, and the components take their prop types from the manifest (`ManifestProps<"Name">`). Everything else reads the manifest: the prop checks, the editor's settings forms, the insert menu and MDXEditor's block descriptors.
- **Remark passes, in order** (one list, `guideRemarkPlugins` in `src/lib/mdx/plugins.ts`, used by the save gate `check.ts`, the server compile `compile.ts` and the editor preview):
  1. `remark-no-code`: refuses `import`/`export`, `{…}` expressions (comments are fine), props written as expressions, spreads, and raw HTML other than `br`, `sub`, `sup`, `kbd`, `mark`, `details`, `summary` without attributes. Guides are content; compiled MDX is run as code (`new Function` in `MDXContent.tsx`), so nothing a guide contains may be code.
  2. `remark-step-sections`: stub `<Step auto>` for required pins.
  3. `remark-default-blocks`: `<BeforeYouGo auto />` first if the guide doesn't place it.
  4. `remark-component-props`: unknown components and props, types and ranges, no-content components, pin references.
- **Movable blocks:** "Before you go", the safety list and the step list are MDX components (`<BeforeYouGo />`, `<SafetyPoints />`, `<Steps />`). The guide's sidebar order comes from the frontmatter `sidebar` (ids in `SIDEBAR_CARDS`, `src/lib/schemas.ts`; cards in `src/components/sidebar/registry.tsx`); the mobile bar follows it.
- **Track math** (`src/lib/track.ts`): projects points onto track segments, searching forward from the previous point so out-and-backs resolve by route order. The match slack scales with the distance from the track. Page mileages (`src/lib/hike.ts`) and ingest both use it.
- **Maps:** `TrailMap` → lazy `MapboxTrailMap`, with `SketchMap` (SVG) as the base layer and fallback. Maps mount only near the viewport and use a pool (`reuseMaps`) to stay under the browser's WebGL context limit. Pins are memoised `WaypointMarker`s.
- **Photos:** Supabase Storage is the source of truth: `<slug>/<NN>-<name>.{full,thumb}.webp`, with all metadata stripped. `public/photos` is a gitignored, dev-only backend (`NEXT_PUBLIC_PHOTO_STORAGE=local`). Production builds refuse it (guard in `next.config.ts`).
- **Editor** (`/editor`, `src/components/editor/`): open to whoever `getEditor()`/`can()` allow (the local owner under `pnpm dev`; on the live site nobody until `EDITOR_AUTH=supabase`).
  - CodeMirror for the guide's MDX and the raw pins JSON, read and saved through the store.
  - Each save sends the version it was based on; a stale one shows a conflict banner and writes nothing.
  - A live preview compiled in the browser with the same remark passes, given the track and `essentials`.
  - Layout per design 3a: Markdown · live preview · a fixed 290px settings column.
  - A settings panel for the component under the cursor or clicked in the preview (`ComponentSettings.tsx` + `jsx-source.ts`, which rewrites only the opening tag through a CodeMirror transaction; `remark-source-markers.ts` makes preview blocks selectable), with Duplicate and Remove.
  - An insert menu grouped by category, and autosave after 1.5 s.
  - MDXEditor (`mdx-editor-config.ts`) is installed for the Write mode (V2 E3); only the tests use it so far.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server on **port 3100** (3000 is taken by another project on the owner's machine). Guides are read from `content/hikes` on each request, so an edited file shows on reload. The editor is open as a local owner |
| `pnpm test` | Vitest (139 tests: store contract on local files, save gate and no-code rule, remark passes, manifest, schemas, geo, track, ingest/GPX helpers, editor source helpers, request guards, MDXEditor round trip on jsdom) |
| `SUPABASE_CONTRACT_TESTS=1 pnpm test supabase` | The same store contract against the real Supabase project, plus the lockdown test. Uses and removes `zz-contract-*` draft rows. Never in CI |
| `pnpm typecheck` | `next typegen && tsc --noEmit` |
| `pnpm build` | `next build` |
| `pnpm content check [--store supabase]` | Every guide passes the save gate (CI runs it on `content/`) |
| `pnpm content seed [slug] [--force]` / `pull [slug]` | Copy guides files → database / database → files, through the store |
| `pnpm editors list` / `add <email> [--role owner]` / `remove <email>` | The editors allow-list. Never creates accounts |
| `pnpm ingest <folder> --slug <slug>` | EXIF → pins, through the store. Merges into existing pins and snaps to the track; `--force` replaces; `--storage local` writes photos to `public/photos`; `--guides supabase` writes the pins to the database |
| `pnpm gpx <file.gpx> --slug <slug>` | GPX → the hike's track (lat/lng/elevation only), through the store; on a new slug it creates a draft hike. `--guides supabase` for the database |
| `pnpm photos check\|push\|pull [slug]` | Photos referenced by `content/` exist in Supabase (CI runs this) / upload local photos / download for offline dev |

CI (`.github/workflows/ci.yml`) runs `content check`, lint, typecheck, tests, `photos check` and build on every push and PR, with no secrets. If the `SUPABASE_SERVICE_ROLE_KEY` repository secret exists, it also checks every stored guide.

Environment switches: `CONTENT_STORE` (`local` default, `supabase`), `EDITOR_AUTH` (unset, `supabase`, `off`), `NEXT_PUBLIC_PHOTO_STORAGE` (`supabase`; `local` in dev only). See `.env.example`.

## Decisions (and why)

- **Commit straight to `main`.** It's the owner's choice, so CI and a local `pnpm build` are the safety net.
- **Pins come from the GPX, photos illustrate them.** Owner, 2026-10-01: not every photo becomes a node. Use one photo per stretch of trail, and no two pins showing the same view. Several photos per point is planned for v3/v4.
- **Timestamps stay private.** `track.json` keeps only `[lng, lat, ele]`. Pace and stop analysis uses the local GPX; only derived facts (grades, "pace drops 3–4×") go into published text.
- **Scroll performance (2026-09-30):** measured on a production build in headless Chrome: about 3% dropped frames and about 16 ms p95 scroll latency. An IntersectionObserver scrollspy, mount hysteresis and deferred map camera moves showed no measurable gain, so they were dropped. Reproduce on the reported page before optimising again.

## Gotchas

- **Next 16.3 evaluates `next.config.ts` in a child process** whose argv lacks `dev`. Detect dev with `process.env.NODE_ENV === "development"`.
- **The service-role key bypasses row-level security.** It lives in `.env.local` and, once the owner adds it, in Vercel as a sensitive server-only variable. Only `src/lib/store/server.ts` (marked `server-only`) and the scripts create a client with it. It is never entered into a dashboard or tool from a coding session; the owner does that.
- **Never create accounts in the real Supabase project from a session**, even test ones. Sign-in can therefore only be verified by the owner; what's unverified is listed in [e2-go-live.md](e2-go-live.md).
- **Stage files explicitly when committing.** `git add -A` once swept an editor autosave of the owner's into a commit; the dev server may be saving while a session works.
- **Postgres `jsonb` reorders object keys.** Use `json` for anything that should read back as written (pins, track).
- **`tsx` ran scripts as CommonJS until the package became `"type": "module"`;** the MDX compiler's dependencies are ESM-only and can't be `require`d.
- **Next generates the `PageProps`/`LayoutProps`/`RouteContext` globals.** Run `next typegen` before `tsc` on a fresh checkout (`pnpm typecheck` does this).
- **Only one `next dev` per folder.** Next 16 refuses a second one. Orphaned servers from earlier sessions have been found on ports 3100/3101.
- **The in-app browser pane can't render while hidden.** No screenshots, and Mapbox doesn't initialise. For visual checks and profiling, use `playwright-core` with system Chrome from the session scratchpad. Never add it to the repo.
- **Mapbox:** the token is URL-restricted, so some tiles return 403 on `localhost`. Every map registers non-passive `wheel`/`touchmove` listeners (Mapbox internals, even with `interactive: false`).
- **iPhone photos:** files dragged out of Photos are tiny previews (`…_4_5005_c.jpeg`, 360–1024 px). Use File → Export, or the original HEIC. Convert HEIC with `sips -s format jpeg` (keeps GPS and heading, writes upright pixels with a normal orientation tag). sharp's prebuilt binary can't decode HEIC.
- **A perceptual hash (dHash) doesn't detect "same vista" duplicates** when the framing differs. Compare heading and content.
- **Structural typing won't catch a manifest prop that a component ignores.** Components take their prop types from the manifest to keep one definition, but nothing forces them to use every prop.
- **`propFields` reads `z.toJSONSchema(..., { io: "input" })`.** Custom `.meta()` keys (`input`, `internal`) come through as JSON Schema keys; `.describe()` becomes `description`.
