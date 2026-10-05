# V2 plan: editing

_Drafted 2026-10-01, revised 2026-10-04 and 2026-10-05. Status: E0 and E1 done. **E2 is built and deployed (2026-10-05) but not switched on:** the live site still reads files and its editor is closed until the owner completes [e2-go-live.md](e2-go-live.md). No more editor features are built until E2 is live and checked._

## Decisions

### Owner, 2026-10-05: Supabase, and it comes first

- **Guides are stored in Supabase in production** (option B below). The git and CMS options are closed.
- **The move is E2, the next big step, before any component-based customisation** (Write mode, the details form, the pin editor all come after).
- **E2 includes sign-in and the guardrails that go with it,** not just the data move.
- **Sign-in is Google** (owner, 2026-10-05), through Supabase Auth.
- Velite was removed during E2.3 (decided in the owner's absence; reversible).

### Owner, 2026-10-04: change of direction

- **No hand-edited files.** Editing `index.mdx` source and raw `waypoints.json` stops being the way guides are made. Writing happens in the rich-text Write mode, the guide's details (today's frontmatter) in a form, and pins on a map and in a form. The Markdown source and the raw JSON stay only under "Advanced", as a fallback.
- **The editor runs inside the deployed web app**, not only under `pnpm dev` on the owner's Mac. This moves "runs in production" from the last milestone to the first remaining one (E2).
- **More editors later is a consideration, not a feature.** Nothing multi-user is built in V2, but no remaining step may make it hard later. See "Designing for more editors later".
- **Still a markdown/rich-text editor with our own components.** The component manifest stays the one definition that drives the editor.
- **Unchanged:** photo uploads from the live site are out of V2 (photos are still added with `pnpm ingest` on the Mac), and Strawberry Peak is the baseline for every milestone.
- **Order** (as renumbered on 2026-10-05): Supabase, sign-in and guardrails (E2) → Write mode and guide details form (E3) → map and pin editor (E4) → create a hike (E5).

### Owner, 2026-10-01 (still standing)

- **Writing:** a rich-text "Write" mode, proven by the E0 spike. Since 2026-10-04 it is the primary way to write, not a second tab.
- **Live-site editing is in V2**, including from the phone, but **without photo uploads** (later).
- **Design reference:** *Trail Guide Branded* in the Claude Design project. It has the editor and sample components.
- **Every guide block is movable per guide.** That includes the ones the page layout used to fix: "Before you go", "Safety points", "Steps" and "Route map". See "Movable blocks" below.

## Goal

Writing and maintaining a hike guide should feel like writing a document in the web app, not editing files. Nobody should need to open `index.mdx` or `waypoints.json` to make or change a guide. The editor must let us use **our own components** (`<Step>`, `<RouteMap>`, `<PhotoCard>`, and later ones like an elevation profile) as first-class blocks: insert them, see them render, change their settings. Adding a new component to the site should make it available in the editor without editor work.

Strawberry Peak is the baseline. Every milestone is done when Strawberry Peak can be edited end to end with it, and the round-trip and E2E tests below pass on it.

## Where we start

As of 2026-10-04 (after E1), `/editor` has: CodeMirror on `index.mdx` and the raw `waypoints.json`, a live preview with the real components, a settings form for the selected component, an insert menu, autosave, and validation before anything is written. Details are in [current.md](current.md).

What stands between that and the goal:

- **Writing is still raw markup.** MDXEditor is installed and its round trip is tested (E0), but no screen uses it yet.
- **Guide details are YAML** at the top of `index.mdx`. There is no form for them.
- **Pins are raw JSON.**
- **Hikes can't be created in the editor.** New hikes come from `pnpm ingest`.
- **It only runs on the owner's Mac.** The editor pages and the save API return 404 unless `NODE_ENV=development`, and saving writes to the local disk (`src/lib/editor-fs.ts`). Vercel's filesystem is read-only, so production needs somewhere else to save.
- **Nothing knows who is editing.** There is no sign-in, and a save overwrites whatever is there.

## Do we need a CMS?

A CMS bundles four things: an editing UI, where content is stored, who may edit (auth), and media handling. We already have media (Supabase plus the ingest pipeline) and a validated content model (zod). This table is about the **editing UI**; where production stores content is a separate question with its own section below.

| Option | What it is | Our components in the editor | Fit |
| --- | --- | --- | --- |
| **A. Our editor + MDXEditor** (chosen 2026-10-01; E0 proved it) | An open-source rich-text MDX editor library (Lexical-based, v4.3, actively maintained) embedded in our `/editor` | Yes: each manifest entry becomes a `jsxComponentDescriptor` with its own React editor, so blocks can render the real component | Keeps MDX as the format, our schemas, the map/photo tooling and the brand design. Where it saves is behind a storage adapter (E2) |
| B. Keystatic | A git-based CMS from Thinkmill. Edits the same files; `github` mode commits from the deployed site | Yes: MDX "content components" (`block`, `wrapper`, `inline`) with prop schemas | Not recommended; see option C under "Production storage" |
| C. TinaCMS | A git-backed CMS with visual editing on the page | Yes: MDX templates | Needs Tina Cloud or a self-hosted backend with a database. Heavier than we need |
| D. Payload, Sanity and the like | A database or hosted CMS | Via their own block systems | Replaces our editor, our schemas and MDX with theirs. A rewrite, not a step |

**We build on A.** Note the difference between row D and the database option under "Production storage": D swaps our editor and content model for a product's; the storage option keeps our editor, our zod schemas and MDX as the format, and only changes where the text is kept.

## Core idea: one component manifest

One definition per component drives everything. As built in E1, it lives in `src/lib/mdx/manifest.ts` (pure zod, no React):

```ts
// src/lib/mdx/manifest.ts (shortened)
Step: {
  title: "Guide section",
  description: "Section for a pin: number, photo, your notes",
  category: "Guide",
  props: z.object({ waypoint: waypointRef().describe("Pin"), hidePhoto: z.boolean().optional().describe("Hide the photo") }).strict(),
  children: "markdown",          // none | markdown
  snippet: '<Step waypoint="{{waypoint}}">…</Step>',
}
```

The `props` schema generates:

1. **The settings panel** (the component-settings panel from the design): a form per prop type, with a waypoint dropdown for `waypointRef`, toggles for booleans, number fields with ranges.
2. **The rich-text editor's block definition** (MDXEditor descriptor, `jsxDescriptors()` in `src/components/editor/mdx-editor-config.ts`), with a live render of the real component inside `HikeProvider` (the live render is E3).
3. **Validation:** the `remark-component-props` pass checks every component's props against its schema, so a typo like `<RouteMap heigth={300} />` is refused at save and fails the build, the way a bad waypoint id does.
4. **The insert menu**, grouped by category.

### How a new component reaches the in-app editor

1. Build the React component.
2. Add its entry to `src/lib/mdx/manifest.ts` (title, description, category, props schema, whether it takes content, snippet).
3. Add it to `src/components/mdx/registry.tsx`. The type there fails the typecheck if the component's props drift from the schema.
4. Deploy.

After the deploy the component is a block in Write mode, has a settings form, is in the insert menu and is validated on save, with no editor code written. This is the same in every storage option: components are code and ship with a deploy; guides are content and only *refer* to components by name. A guide can never define a component.

### Movable blocks

Built in E1. Blocks that used to be fixed page layout are content a guide can place:

- **Article blocks are registry components:** `<BeforeYouGo />` (reading `essentials` from the frontmatter, so its data stays structured), plus `<SafetyPoints />` and `<Steps />` as inline versions of the sidebar cards, next to `<RouteMap />`.
- **Defaults keep old guides unchanged:** a guide that doesn't place `<BeforeYouGo />` gets it at the top (`remark-default-blocks`, the same idea as auto-inserted step stubs).
- **The sidebar is per-guide:** an optional `sidebar: [minimap, safety, steps]` in the frontmatter, validated against `SIDEBAR_CARDS`; the default is that order. The reorderable list for it in the editor comes with E3's guide details form.

## Milestones

E0 and E1 are recorded as they were written. Where they say "E2" they mean Write mode, which is now E3.

**E0: Spike. ✅ Done 2026-10-01: GO.** MDXEditor 4.3.1 round-trips every guide with the same frontmatter and the same MDX syntax tree, and a second pass changes nothing. Strawberry Peak comes back byte-for-byte (apart from the final newline). Comments, numeric and boolean props, and headings, lists and links inside `<Step>` all survive. The remaining normalisations, once applied, are stable:
- children of block components are indented 2 spaces
- `_em_` becomes `*em*`
- the final newline is dropped (the save path adds it back)

`bullet: "-"` and `rule: "-"` keep our list and rule style. It renders in Next 16 dev with React 19 and Turbopack (client-only via `next/dynamic`), with no errors. The setup lives in `src/components/editor/mdx-editor-config.ts`; `src/components/editor/__tests__/roundtrip.test.tsx` runs in CI on jsdom. As expected, generic JSX blocks don't show props yet (E1) and the editor is unstyled (E2).

**E1: Component manifest, settings panel, movable blocks. ✅ Done 2026-10-04.** The authoring view follows *Trail Guide Branded* screen 3a (Markdown · live preview · 290px settings column; click a component in the preview to select it; Duplicate / Remove). The remaining differences from the design are in [todo.md](todo.md). As built:
- `src/lib/mdx/manifest.ts` (pure zod) is the source of each component's props: build checks, the editor's forms, the insert-menu categories and the rich-text descriptors all read it, and the components take their prop types from it.
- `remark-component-props` and `remark-default-blocks` run in Velite, in the editor preview and in the save API (`src/lib/mdx/check.ts`), so the editor can no longer write a guide that won't build.
- The settings panel shows the component under the cursor, or the one clicked in the preview (`remark-source-markers.ts` tags preview blocks with their source offset), and rewrites only its opening tag (`src/components/editor/jsx-source.ts`).
- New blocks `<BeforeYouGo />`, `<SafetyPoints />`, `<Steps />`, plus frontmatter `sidebar`.
- The preview gets `track.json`, so its mileage and route match the live page.

Original scope:
- Read *Trail Guide Branded* for the editor and settings-panel design and its sample components.
- Props schemas for all registry components; build-time prop validation in the remark pass.
- Movable blocks (above): `<BeforeYouGo />`, `<SafetyPoints />`, `<Steps />` and a per-guide `sidebar` order, all with defaults so Strawberry Peak renders the same until it's edited.
- The settings panel from the design: click a component in the source or the preview and edit its props in a form.
- Fix the preview mileage bug ([todo.md](todo.md)).
- Tests: schema-to-form mapping, and prop validation on Strawberry Peak.

**E2: Guides move to Supabase, with sign-in and guardrails. 🟡 Built 2026-10-05, waiting on the owner to switch it on.** All five parts are in `main`. What was verified, what couldn't be without keys, and the owner's steps are in [e2-go-live.md](e2-go-live.md). Differences from the plan below: the sign-in is Google OAuth; the Supabase contract tests run against the real project with namespaced draft rows (no Docker for a local database); the E2E access tests exist only as manual checks so far ([todo.md](todo.md)).

The plan as written: the big step before any more editor features. It ships in five parts; the live site keeps working after each.

Done when: Strawberry Peak on the live site is served from the database; the owner signs in on the live site, edits it with today's editor, and the change is public within seconds with no deploy; and a signed-out visitor or a signed-in non-editor can neither see the editor nor write anything.

*E2.1 Boundary (no visible change).*
- **One storage interface**, `ContentStore` (the name `hike-store` is taken by the page's zustand store):
  - `list()`: every hike with its slug, title, draft/published status, and who last saved it and when.
  - `read(slug)`: `{ mdx, waypoints, track }` plus a `version` (a token for "the state I loaded") and the status.
  - `save(slug, { mdx, waypoints }, { editor, baseVersion })`: validates, then writes. Returns the new version, or the list of problems, or a conflict if the hike changed since `baseVersion`.
  - `create(...)`, `publish(slug)` / `unpublish(slug)`, and replacing the track.
- **Validation lives in front of every implementation.** Today's `validateHikeFiles` (schemas plus the MDX compile in `src/lib/mdx/check.ts`) moves out of `editor-fs.ts`, so no store can write a guide that skipped it.
- **Local filesystem implementation** = what `src/lib/editor-fs.ts` does today, for `pnpm dev` and tests. Its version is a hash of the files; its status is the frontmatter `draft` flag.
- **One place answers "who is this and may they do it":** `getEditor()` (the signed-in person, or nobody) and `can(editor, action, slug)`. It replaces the `editorEnabled` flag. In `pnpm dev` with the local store it returns a fixed local owner.
- **The editor sends `baseVersion` with each save** and shows "this hike changed since you opened it" on a conflict instead of overwriting.
- **No code in guides.** The guide page runs compiled MDX as code (`new Function` in `src/components/mdx/MDXContent.tsx`). The save gate must refuse MDX `import`/`export` lines, `{…}` expressions in the text and props written as non-literal expressions (comments excepted). None of the three guides uses them.
- **A contract test suite** that every implementation must pass (see Testing).

*E2.2 Database.*
- **Migrations live in the repo** (`supabase/migrations/`), applied to project `fstcgdirhssuaevgxptv`.
- **Tables:**
  - `hikes`: slug, the MDX text, pins (JSON), track (JSON), status, a version number, `updated_by`, `updated_at`, and the validated details (title, region, stats…) copied into columns at save so the gallery can list hikes without parsing MDX.
  - `hike_revisions`: one row per save (who, when, the content), for history and undo.
  - `editors`: user id and role (only `owner` at first).
- **Row-level security** (rules inside the database about which signed-in user may read or change which rows) is on for every table with **no policies for browser roles**: nothing can be read or written with the public key or a signed-in user's token. Only our server, using the service-role key, touches these tables. So an editor can't skip the save gate by calling Supabase directly, and the public can't read drafts.
- **The Supabase store** implements `ContentStore` and passes the contract tests.
- **Seed and export:** `pnpm content seed` copies `content/hikes/*` into the database through the store, refusing to overwrite a newer row unless forced. `pnpm content pull <slug>` writes a hike back to files. `content/` stays in the repo as seed data, fixtures and the test baseline (Strawberry Peak), and is no longer what the live site shows.
- Close the existing advisor warning: `public.rls_auto_enable()` is callable by anyone (found 2026-10-05).

*E2.3 The site reads from the store.*
- `src/lib/content.ts` reads through the store: the database in production, `content/` files in `pnpm dev` by default (so dev works offline), switchable to the database with an env variable.
- **MDX is compiled on the server at render time and cached; compiled output isn't stored.** Compiled output depends on our code (the remark passes, the manifest), so stored output would go stale on a deploy. It also means the checks run on every compile: a row that somehow got around the save gate fails to render instead of running.
- The guide page and gallery are cached per hike and refreshed when that hike is saved or published (Next 16 has `cacheTag` with `revalidateTag`/`updateTag`; read `node_modules/next/dist/docs` before building). The page stops being limited to hikes known at build time (`dynamicParams = false` today).
- **If the database can't be reached, keep serving the last good render.** The project is on Supabase's free plan (checked 2026-10-05), which pauses a project after about a week without activity. Guard: a small daily scheduled request from Vercel that reads from the database, plus the cached pages. Moving to a paid plan removes the risk; that is the owner's call.
- **Velite leaves the render path** (see "Open questions" for retiring it): dev and production render through the same store and the same server compile, so there is one render path, not two.
- `pnpm ingest` and `pnpm gpx` write through the store: to files by default, to the database with a flag.

*E2.4 Sign-in.*
- **Supabase Auth**, with the session in http-only cookies (`@supabase/ssr`), refreshed on the server.
- **Every editor page and API route checks the session on the server** through `getEditor()`; hiding a link in the UI is never the protection.
- **Being signed in is not enough:** `can()` must find the user in `editors`. An account that isn't there can do nothing.
- **Sign-ups are closed** in the Supabase project settings. The first editor (the owner) is added by hand.
- Outsiders get a **404**, not a "forbidden" page, on `/editor` and the save API, as today.
- A sign-in page, the signed-in name in the editor's top bar, and sign out.

*E2.5 The editor on the live site, and the guardrail checklist.*
- The dev-only switch is removed; `/editor` in production is gated by `can()`.
- The save route, in order: same-origin check (refuses requests from other sites), body size limit, per-user rate limit, session and `can()`, the save gate, the version check, then the write plus a `hike_revisions` row, then the cache refresh.
- **Guardrails, all of which must hold before E2 is called done:**
  - Row-level security on every table, deny by default; Supabase's security advisor shows no warnings.
  - The service-role key (it bypasses row-level security) is server-only: on Vercel as a sensitive variable without the `NEXT_PUBLIC_` prefix, only imported from modules marked `server-only`, and never in the repo. **The owner adds it to Vercel**; it isn't handled in a coding session.
  - Sign-ups closed; editors allow-listed.
  - Server-side session checks on every editor page and route; 404 for everyone else.
  - Guides can't carry code (E2.1), and every save passes the schemas and the MDX compile.
  - A save from a stale tab is rejected, not merged silently.
  - Every save is recorded with who and when, and can be restored from `hike_revisions`; `pnpm content pull` gives a file copy.
  - A read-only check in CI runs the save gate over every stored guide, so a code change that breaks stored guides is caught even though no build fails.
  - E2E access tests: signed out, `/editor` and the save API are 404; a signed-in non-editor gets 404; an editor can save.
- **Photos stay out** (owner, 2026-10-01): the live editor covers text, components and pins; photos are added with `pnpm ingest` on the Mac.

**E3: Write mode and the guide details form** (the primary way to write).
- **"Write" is the default view:** rich text with headings, bold and italic, lists, links, and an "insert component" button. Components show as live blocks; clicking one opens the E1 settings panel. `<Step>` blocks show their pin's number, photo and caption, with editable notes inside.
- **A "Guide details" form generated from `frontmatterSchema`** (`src/lib/schemas.ts`), the way component forms are generated from the manifest: title, region, summary, distance, elevation gain, difficulty, time, best season, cover photo, trailhead, date, the "Before you go" essentials, and the sidebar order as a reorderable list. The slug is shown but not editable. Nobody types YAML.
- **Draft/published is a "Publish" button and a status**, backed by the store's `publish`, with "Autosaved … ago" beside it (both are in design 3a; see [todo.md](todo.md)).
- **"Advanced" holds the Markdown source** (today's CodeMirror view). Both views edit the same document; autosave and validation are unchanged.
- Apply E0's one-time normalisations (2-space indent inside blocks, `*em*`) to the stored guides once first, so the first Write-mode save of a guide isn't a noisy diff.
- Done when Strawberry Peak's text and details can be rewritten without opening the source view.

**E4: Map and pin editor** (replaces the raw `waypoints.json` tab; the JSON moves under "Advanced").
- A map with the track and pins. Drag a pin and it snaps to the track (`src/lib/track.ts`); drag the view cone to set the heading.
- Click the track to add a pin; delete pins; order follows trail mileage automatically.
- A form per pin: type, label, title, caption, note, and a photo picker from the photos already uploaded for the hike. Listing them needs a small server route, since the browser only knows the photos that pins already use.
- E2E test: move Strawberry Peak's saddle pin and check the mileage and step order update.

**E5: Create a hike in the app.**
- A "New hike" form: the same generated form as E3's guide details, saved with the store's `create` as a draft.
- **GPX upload, read in the browser.** `parseGpx` and `buildTrack` (`scripts/lib/gpx.ts`) are plain functions with no file access; they move to `src/lib` so the browser can run them. Only `[lng, lat, ele]` is sent to the server, which keeps the "timestamps stay private" decision ([current.md](current.md)). Distance and gain in the form are filled from the track.
- **Pins start without photos** (the schema allows it) and are placed on the track in the E4 editor. Photos are attached later with `pnpm ingest --slug <slug>` on the Mac, which merges into existing pins.
- Lands in the E4 pin editor as a draft.

## Production storage: decided, Supabase

Decided by the owner on 2026-10-05: **the database (option B)**. The comparison is kept for the record of why.

| | A. Git as the store | **B. Database as the store (Supabase), chosen** | C. Keystatic or another git-based CMS |
| --- | --- | --- | --- |
| What a save does | A commit to `main` through the GitHub API; Vercel redeploys | A row is written in Postgres in the Supabase project we already use for photos (`fstcgdirhssuaevgxptv`) | Same as A, through the CMS's admin UI |
| Time until live | About a minute (a full deploy) | Seconds: the site is told to refresh that one guide (on-demand revalidation: throwing away the cached copy of a page so the next visitor gets a fresh one) | About a minute |
| Validation | At save (our gate) and again at build (Velite) | At save (our gate) and at every server compile | The CMS's own field types; our zod schemas become a second model |
| Several editors | Awkward: every save is a deploy, two people editing produce conflicting commits, permissions are all-or-nothing | Fits: sign-in, an editors list, drafts and history as data | Inherits A's limits |
| Size of the work | Smallest | Largest | Medium, and most of our editor is thrown away |

**Why B:** more editors is a stated future need, and every weakness of A is a multi-user weakness. Supabase is already in the stack, so this adds tables and sign-in to a service we run, not a new vendor.

**What it costs, and how E2 covers it:**
- **A code change can break stored guides without a failed build.** Today renaming a prop fails the build until the guides are fixed; with guides in a database nothing fails. Covered by the CI check over stored guides and the last-good-render fallback (E2.3, E2.5).
- **The database becomes something the live site depends on.** Covered by caching, the daily keep-alive and the fallback (E2.3); the free plan's pausing is the remaining risk.
- **A powerful key must exist on Vercel.** Covered by the server-only rules in E2.5.

## Designing for more editors later

Not built in V2, but cheap now and expensive to retrofit. Each of these is in E2:

- **Identity on every save.** `save` takes the editor and the store records who and when. The local store may ignore it, but the interface requires it.
- **Roles from the start**, even with one: `can(editor, action, slug)` is the only place that decides, and it takes the slug so per-hike permissions can be added without touching callers. Today it returns true for the owner.
- **Draft and published are data, not only a frontmatter flag.** `publish` is its own operation in the store, separate from `save`, so "edit a published guide without changing what's live until Publish" can be added behind it. In the database this would be a working copy next to the published revision.
- **Optimistic concurrency, not last-write-wins.** A save is rejected if the hike changed since it was loaded (the `version` in E2), so two tabs, or later two people, can't silently overwrite each other.
- **Revision history.** The `hike_revisions` table, so a bad save can be undone.
- **No single-user assumptions in URLs or the interface.** `/editor/[slug]` names a hike, never "my draft". The store never reads a global "current user"; the editor is passed in.

Explicitly **not** being built yet: real-time co-editing (two cursors in one document), comments and review, an invitations UI (the first extra editors can be added by hand in the `editors` table), and a per-hike permissions UI.

## Testing against the baseline

- **Round trip:** Strawberry Peak's `index.mdx` loaded and saved by the editor is unchanged, or changes only in an agreed normalised form. From E3 the same holds for a save from Write mode and for a save of the guide details form with no field changed.
- **Storage contract:** one test suite written against `ContentStore`, run against every implementation: the local one on a temp folder, and the Supabase one (against a local Supabase or a separate test schema, never the production tables). It covers: list, read, save and read back unchanged, an invalid save writes nothing, a save with a stale version is rejected, create, publish/unpublish, and that the editor is recorded. Strawberry Peak is the fixture.
- **E2E:** Playwright test on `/editor/strawberry-peak`: write in Write mode, insert a component, change a setting, change a guide detail in the form, move a pin, save, and verify the stored guide and the rendered page. One more on access: signed out, `/editor` and the save API return 404. This adds `@playwright/test` as a dev dependency (until now Playwright has only been used ad hoc from the scratchpad).
- **Unit:** manifest → form, `frontmatterSchema` → form, prop validation, the save gate's refusal of imports and expressions, the pin editor's snap and reorder logic (pure functions, next to `src/lib/track.ts`).

## Open questions

- **Supabase plan.** Free today (pauses after about a week idle). E2.3 adds a keep-alive; a paid plan removes the risk.
- **Phone layout for the editor.** Design 3a is three columns with a fixed 290px settings column. What Write mode, the settings form and the pin map look like on a phone isn't designed, and the owner wants to edit from the phone.
