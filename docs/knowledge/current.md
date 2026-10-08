# Current state

_Last updated 2026-10-07. Version: **V1 shipped** (commit `aa9298f`); **V2 (editing)**: every milestone (E0–E5) is in `main`, followed on 2026-10-06/07 by a full audit and its fixes ([changelog.md](changelog.md)). The site reads guides from Supabase (`CONTENT_STORE=supabase`) and the editor is open to the owner through Google sign-in (`EDITOR_AUTH=supabase`, sign-ups closed, `juanpram2000@gmail.com` is the owner on the editors list). Sign-in, a live save and the page refresh were verified on the live site on 2026-10-06; what's still unchecked is in [e2-go-live.md](e2-go-live.md). What's left before the first tagged release: [todo.md](todo.md). Plan: [v2-plan.md](v2-plan.md)._

Trailnotes is a photo-by-photo hiking guide site. Each hike is an MDX guide whose route, turning points and view directions come from a GPS recording (GPX) and the EXIF data of the hiker's photos.

- **Live:** https://trail-notes-amber.vercel.app. Every push to `main` deploys to production.
- **Repo:** github.com/JuanRamirez2000/trail-notes (public). Work happens directly on `main`, by the owner's choice, so every commit must build and pass CI.
- **Vercel:** project `prj_BRkSr8pDopFEqEJGNNNtKhUOaPwl`, team `team_xA3s7AnPMr8p1ZVJafHQupxT`. Use the claude.ai Vercel connector; the plugin connector returns 403 on this team.
- **Supabase:** project `fstcgdirhssuaevgxptv` ("trail-notes", us-east-2, Postgres 17, **free plan**: pauses after about a week idle).
  - Storage: the public bucket `hikes` (photos).
  - Tables `hikes`, `hike_revisions`, `editors` (migrations in `supabase/migrations/`, applied with the Supabase connector). Row-level security is on with explicit "server only" policies: the public key and signed-in browser sessions can read and write nothing; only the server's service-role key can.
  - The three guides are seeded. Auth: Google provider on, sign-ups closed, one editor (the owner).
- **Design source:** Claude Design project `87e465cf-146d-4327-9930-d7562360f28b`. *Trail Guide Branded.dc.html* has the screens: 1 gallery, 2 guide page, 3a authoring view, 4a component sheet. It's readable from a session with the `DesignSync` tool (`list_files` / `get_file`) when the owner asks for it; inline styles map 1:1 onto the tokens in `globals.css`.

## Baseline hike: Strawberry Peak

`content/hikes/strawberry-peak` is the reference for all new work: features, the editor, tests and demos (the store's contract tests use it as their fixture). It's the only published hike, and the only one built from real data:

- `track.json` from a Garmin GPX (2026-04-19): 7.31 mi, 1,830 ft gain, out-and-back from Red Box to a 6,140 ft summit.
- 6 pins, each at a point where the recording changes character, with one photo per pin (6 of the 19 taken; see [backlog.md](backlog.md) for how they were picked): Red Box (start, 0.0 mi), mountain curve (1.1), saddle (2.4), rocky climb (2.8), steepest pitch (3.4), summit (3.6). Every pin is a `note`, except the trailhead.
- Captions and the "Before you go" card were written from the recording's grades, elevations and pace. The original photos are in the owner's `~/Downloads/straberry/` (HEIC); the GPX is `~/Downloads/activity_22587017513.gpx`. Both are local only, never committed.

`ridgeline-loop` and `granite-saddle` are `draft: true` samples (placeholder photos, made-up routes). They only show under `pnpm dev`. Keep them as fixtures: `granite-saddle` exercises every pin type and section rule.

## Architecture

```
ContentStore (src/lib/store)                      one interface: list, read, save, create, setTrack, remove
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
  - `types.ts` is the interface. `store.ts` (`createStore(backend)`) holds all the rules once: nothing reaches a backend without `validateHike`, every change names the version it's based on and a stale one is refused, and status (draft/published) follows the guide's `draft` flag so files and database agree. Publishing is therefore a normal `save`; there is no separate publish operation. `remove` is for tests and scripts (the editor has no delete).
  - The address `new` is reserved (`RESERVED_SLUGS` in `schemas.ts`) and refused by `validateHike`, so the scripts can't create it either.
  - Backends only read and write raw records: `local.ts` (version = hash of the files; an invalid hand-edited guide is still readable, flagged `details: null`; a `track.json` that doesn't validate is flagged `trackUnreadable` and the store refuses to save over it rather than delete it; writes to one hike are queued so two saves from the same version can't both pass) and `supabase.ts` (version = integer column; `save_hike` / `create_hike` database functions update and write the history row in one transaction).
  - `server.ts` (`getStore()`, `server-only`) picks by `CONTENT_STORE`. It is explicit, not "is a key present", so a missing key is a loud error, and so is a mistyped value (`next.config.ts` checks `CONTENT_STORE`, `EDITOR_AUTH` and `NEXT_PUBLIC_PHOTO_STORAGE` at startup).
  - Pins are stored exactly as written (validated, not rewritten); the database columns are `json`, not `jsonb`, because jsonb reorders keys.
- **Rendering:** `src/lib/content.ts` reads through the store and compiles MDX on the server (`compileGuide`). `/` and `/hikes/[slug]` are static with `revalidate = 3600` and `dynamicParams = true`: refreshed when the editor saves (`revalidatePath`), hourly as a safety net, and a failed refresh keeps the last good page. Drafts show only under `pnpm dev`. `content/hikes` ships in the server bundle (`outputFileTracingIncludes`), and a missing folder is an error rather than "no hikes".
- **Identity** (`src/lib/auth/`): `getEditor()` (`server.ts`) and `can()` (`can.ts`) are the only access checks, always on the server. `EDITOR_AUTH` picks the mode: unset = a fixed local owner under `pnpm dev`, nobody anywhere else; `supabase` = Google sign-in through Supabase Auth, and only users in the `editors` table count; `off` = nobody. Routes: `/sign-in`, `/auth/sign-in`, `/auth/callback` (signs a non-editor straight back out), `/auth/sign-out`; `src/proxy.ts` refreshes the session for editor routes only. Outsiders get a 404 everywhere.
- **Public pages around the guides:** `robots.ts` and `sitemap.ts` (published hikes only; absolute links come from `src/lib/site.ts`: `NEXT_PUBLIC_SITE_URL`, else Vercel's production domain), Open Graph/Twitter cards (the cover photo is the card image), `error.tsx` and `global-error.tsx` (Next 16 passes `retry`, not `reset`), `not-found.tsx`, a skip link and a footer (`components/ui/`). `next.config.ts` sends four security headers on every response; there is no Content-Security-Policy yet (the preview evaluates compiled MDX and Mapbox needs `blob:` workers, so it has to start report-only).
- **Create route** (`src/app/api/editor/route.ts`, `POST`): the same guards, then `store.create`. The form behind it is `/editor/new` (`NewHikeForm.tsx`): an optional GPX is parsed in the browser with `src/lib/gpx.ts`, so only `[lng, lat, ele]` is ever sent, and `src/lib/new-hike.ts` builds the draft (details, a route map, a trailhead pin). The address `new` is reserved.
- **Save route** (`src/app/api/editor/[slug]/route.ts`), in order: editor check, same-origin, size and rate limits (`src/lib/auth/request.ts`), then the store (validation, version), then `revalidatePath`. Conflicts are 409, invalid content 422. Both editor routes answer every other method with 404 too. When a save changes the status (Publish/Unpublish) the route fetches the page and the gallery itself afterwards (`after()`): from a route handler `revalidatePath` only marks a page, and the next request is still served the old copy, so that request is ours instead of a visitor's.
- **Keep-alive:** `vercel.json` runs `/api/health` daily; with the Supabase store it reads from the database so the free-plan project doesn't pause. It reports the number of published hikes only, and answers 503 when the store can't be read (nothing watches it yet: see [todo.md](todo.md)).
- **Pins and guide sections** (`src/lib/pins.ts`): `start/turn/note/bailout` require a section and are numbered steps; if the MDX has no `<Step>` for one, `src/lib/mdx/remark-step-sections.ts` inserts a stub in route order. `viewpoint/landmark/water/ranger` are optional. The safety pins are `water/ranger/bailout`.
- **Component manifest:** `src/lib/mdx/manifest.ts` (pure zod, no React) defines every MDX component's props, title, category, snippet and whether it takes content. `src/components/mdx/registry.tsx` maps each name to its React component, and the components take their prop types from the manifest (`ManifestProps<"Name">`). Everything else reads the manifest: the prop checks, the editor's settings forms, the insert menu and MDXEditor's block descriptors.
- **Remark passes, in order** (one list, `guideRemarkPlugins` in `src/lib/mdx/plugins.ts`, used by the save gate `check.ts`, the server compile `compile.ts` and the editor preview):
  1. `remark-no-code`: refuses `import`/`export`, `{…}` expressions (comments are fine), props written as expressions, spreads, raw HTML other than `br`, `sub`, `sup`, `kbd`, `mark`, `details`, `summary` without attributes, and links or images that point anywhere but `http(s)`, `mailto`, `tel` or this site. Guides are content; compiled MDX is run as code (`new Function` in `MDXContent.tsx`), so nothing a guide contains may be code. "Is this expression only a comment" is a linear scan (`isComment`), not a regex: see Gotchas.
  2. `remark-step-sections`: stub `<Step auto>` for required pins; a `<Step>` inside a paragraph is refused.
  3. `remark-default-blocks`: `<BeforeYouGo auto />` first if the guide doesn't place it.
  4. `remark-component-props`: unknown components and props, types and ranges, no-content components, pin references.
- **Movable blocks:** "Before you go", the safety list and the step list are MDX components (`<BeforeYouGo />`, `<SafetyPoints />`, `<Steps />`). The guide's sidebar order comes from the frontmatter `sidebar` (ids in `SIDEBAR_CARDS`, `src/lib/schemas.ts`; cards in `src/components/sidebar/registry.tsx`); the mobile bar follows it.
- **Track math** (`src/lib/track.ts`): projects points onto track segments, searching forward from the previous point so out-and-backs resolve by route order. The match slack scales with the distance from the track. Page mileages (`src/lib/hike.ts`) and ingest both use it.
- **Maps:** `TrailMap` → lazy `MapboxTrailMap`, with `SketchMap` (SVG) as the base layer and fallback. Maps mount only near the viewport and use a pool (`reuseMaps`) to stay under the browser's WebGL context limit. Pins are memoised `WaypointMarker`s.
- **Photos:** Supabase Storage is the source of truth: `<slug>/<NN>-<name>.{full,thumb}.webp`, with all metadata stripped. `public/photos` is a gitignored, dev-only backend (`NEXT_PUBLIC_PHOTO_STORAGE=local`). Production builds refuse it (guard in `next.config.ts`).
- **Editor** (`/editor`, `src/components/editor/`): open to whoever `getEditor()`/`can()` allow (the local owner under `pnpm dev`; on the live site, editors signed in with Google).
  - `Editor.tsx` is the shell: it holds the guide (MDX + pins JSON), autosaves after 1.5 s through the store, and switches between four views of the same document. Each save sends the version it was based on; a stale one shows a conflict banner and writes nothing. Saves go one at a time: one asked for while another is on its way waits, then sends the newest text with the version just received. Leaving with unsaved text asks first (`beforeunload`).
  - **Write** (default, `write/WriteView.tsx`): MDXEditor on the body only. Every manifest component is a live block rendering the real component inside a `HikeProvider`; a block's own text (a Step's notes) is a nested editor inside it; the selected block renders its generated `SettingsForm` into the settings column through a portal. `mdx-editor-config.ts` holds the shared plugin setup (also used by the round-trip test). If MDXEditor reports that it can't parse the guide, the view replaces itself with a notice and a button to Advanced (see Gotchas).
  - **Details** (`DetailsForm.tsx`): a form generated from `frontmatterSchema` (labels are the schema's `.describe()`); each change rewrites one frontmatter entry with `src/lib/frontmatter.ts`, leaving the rest of the YAML as written. A frontmatter with a YAML error is shown as the error (`yamlProblems`) instead of a form, and Publish says why it can't; `setDetail` throws rather than rewrite YAML it can't read. `frontmatter.ts` is also the one home of the frontmatter regex and `blankFrontmatter`.
  - **Pins** (`pins/PinsView.tsx`, `pins/PinMap.tsx`): the pins on an interactive map (drag to move, snapping onto the track within about 80 m; drag the yellow handle to aim the photo direction; add by clicking), a list in route order and a form per pin. All edits are pure functions over the pins JSON as written (`pins/pin-ops.ts`): they keep fields and their order, renumber `order` in steps of 10, slot a new pin in by trail mileage, and rename a pin together with the blocks that point at it (however the reference is written: either quote, spaces around `=`, or `{"id"}`). The form keeps an empty label or title, or an out-of-range number, to itself until it's a value the pins can hold, so the pins JSON is never invalid halfway through typing.
  - **Advanced** (`AdvancedView.tsx`): CodeMirror for the raw Markdown and pins JSON, a live preview compiled in the browser with the same remark passes, and the settings column for the component under the cursor or clicked in the preview (`jsx-source.ts` rewrites only the opening tag; `remark-source-markers.ts` makes preview blocks selectable). Layout per design 3a.
  - Publish / Unpublish flip the guide's `draft` flag (a normal, autosaved change).
  - `writtenProps` (`jsx-source.ts`) is the one rule for which props get written (defaults and unticked optional checkboxes are left out), used by both the Markdown tag writer and the Write view.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server on **port 3100** (3000 is taken by another project on the owner's machine). It listens on `127.0.0.1` only: under dev the editor is an owner with no sign-in, so it must not be reachable from the network (`pnpm dev:lan` listens on all interfaces, for checking on a phone). Guides are read from `content/hikes` on each request, so an edited file shows on reload |
| `pnpm test` | Vitest (235 tests: new-hike builder, pin operations, frontmatter split/join/edit, store contract on local files, the two editor API routes called as Next calls them, the editor's save loop on jsdom, save gate and no-code rule, remark passes, manifest, schemas, geo, track, ingest/GPX helpers, editor source helpers, request guards, MDXEditor round trip on jsdom) |
| `SUPABASE_CONTRACT_TESTS=1 pnpm test supabase` | The same store contract against the real Supabase project, plus the lockdown test. Uses and removes `zz-contract-*` draft rows. Never in CI |
| `pnpm typecheck` | `next typegen && tsc --noEmit` |
| `pnpm build` | `next build` |
| `pnpm content check [--store supabase]` | Every guide passes the save gate (CI runs it on `content/`) |
| `pnpm content seed [slug] [--force]` / `pull [slug]` | Copy guides files → database / database → files, through the store |
| `pnpm editors list` / `add <email> [--role owner]` / `remove <email>` | The editors allow-list. Never creates accounts |
| `pnpm ingest <folder> --slug <slug>` | EXIF → pins, through the store. Merges into existing pins and snaps to the track; `--force` replaces; `--storage local` writes photos to `public/photos`; `--guides supabase` writes the pins to the database |
| `pnpm gpx <file.gpx> --slug <slug>` | (Also possible in the app: New hike.) GPX → the hike's track (lat/lng/elevation only), through the store; on a new slug it creates a draft hike. `--guides supabase` for the database |
| `pnpm sample:photos [slug]` | Placeholder JPEGs with real EXIF in `fixtures/sample-photos/<slug>/`, for trying the pipeline |
| `pnpm photos check\|push\|pull [slug]` | Photos referenced by `content/` exist in Supabase (CI runs this) / upload local photos / download for offline dev |

CI (`.github/workflows/ci.yml`) runs `content check`, lint, typecheck, tests, `photos check` and build on every push and PR, with no secrets. If the `SUPABASE_SERVICE_ROLE_KEY` repository secret exists, it also checks every stored guide. On 2026-10-06 that secret was not set, so the step is skipped and CI covers the files in `content/`, not what the live site serves.

Environment switches: `CONTENT_STORE` (`local` default, `supabase`), `EDITOR_AUTH` (unset, `supabase`, `off`), `NEXT_PUBLIC_PHOTO_STORAGE` (`supabase`; `local` in dev only). See `.env.example`.

## Decisions (and why)

- **Commit straight to `main`.** It's the owner's choice, so CI and a local `pnpm build` are the safety net.
- **Pins come from the GPX, photos illustrate them.** Owner, 2026-10-01: not every photo becomes a node. Use one photo per stretch of trail, and no two pins showing the same view. Several photos per point is planned for v3/v4.
- **Timestamps stay private.** `track.json` keeps only `[lng, lat, ele]`, and pins have no capture time: `pnpm ingest` uses it to order the photos and doesn't store it, and the pin schema has no such field, so one left in a stored pin is dropped when the pins are read. (Until 2026-10-07 pins carried `takenAt` and it reached the public page; rows saved before then, old revisions and the repo's git history still hold it: see [todo.md](todo.md).) Pace and stop analysis uses the local GPX; only derived facts (grades, "pace drops 3–4×") go into published text.
- **Turn pins use dark ink.** White on the turn colour was 3.27:1; `PIN_STYLES[*].ink` sets the glyph colour per type so each is at least 4.5:1.
- **Scroll performance (2026-09-30):** measured on a production build in headless Chrome: about 3% dropped frames and about 16 ms p95 scroll latency. An IntersectionObserver scrollspy, mount hysteresis and deferred map camera moves showed no measurable gain, so they were dropped. Reproduce on the reported page before optimising again.

## Gotchas

- **Next 16.3 evaluates `next.config.ts` in a child process** whose argv lacks `dev`. Detect dev with `process.env.NODE_ENV === "development"`.
- **A regex is the wrong tool for "is this only comments".** Until 2026-10-06 the no-code rule used `/^\s*(\/\*[\s\S]*?\*\/\s*)*$/`: backtracking let `{/* a */ code /* b */}` through as one comment (the code then ran during page render), and a run of `/**/` took exponential time. `isComment` scans instead, and the hostile inputs are in `component-props.test.ts`. Anything added to the gate should get the same treatment: a test that tries to smuggle code past it.
- **The Write view can't show everything the gate accepts.** MDXEditor has no image, code-block, reference-link or footnote support here; when it meets one it reports to `onError`, renders the guide only up to that point and stops reporting edits. `WriteView` therefore steps aside on any `onError`. Don't turn that back into a console message.
- **The service-role key bypasses row-level security.** It lives in `.env.local` and in Vercel as a sensitive server-only variable. The client factory is `serviceClient()` in `src/lib/store/supabase.ts`; the app only reaches it through `src/lib/store/server.ts` (marked `server-only`, used by the store and by `auth/server.ts` for the editors lookup), and the scripts create their own. It is never entered into a dashboard or tool from a coding session; the owner does that.
- **Never create accounts in the real Supabase project from a session**, even test ones. Sign-in can therefore only be verified by the owner; what's unverified is listed in [e2-go-live.md](e2-go-live.md).
- **MDXEditor writes a trailing space as `&#x20;`.** `WriteView` strips it before the text is saved.
- **MDXEditor only commits a block's nested text on blur.** `WriteView` asks the nested field to commit 500 ms after a keystroke (dispatching `NESTED_EDITOR_UPDATED_COMMAND` to the field's Lexical editor, found on the element as `__lexicalEditor`), otherwise autosave misses text still being typed. It listens to key/paste events, not `input`: Lexical cancels `beforeinput`, so `input` never fires.
- **MDXEditor deletes a whole block on Backspace in its empty text field.** `WriteView` swallows that keystroke; blocks are removed with the Remove button.
- **Maps: the Mapbox layer stays `invisible` until it has painted** (`TrailMap.tsx`). Otherwise, while tiles are loading or refused, Mapbox's pins show on top of the sketch map's pins and every pin appears twice.
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
