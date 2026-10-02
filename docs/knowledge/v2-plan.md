# V2 plan: editing

_Drafted 2026-10-01. Status: **agreed**; E0 done (go); **E1 done (2026-10-02)** apart from the design-based styling. Next: E2._

## Decisions (owner, 2026-10-01)

- **Writing:** a rich-text "Write" mode (E0 spike → E2), with Markdown source kept as a second tab.
- **Live-site editing is in V2** (E5), including from the phone, but **without photo uploads** (later).
- **Order:** the text editor first (E0 → E1 → E2), then the pin editor (E3), creating a hike (E4), and live-site editing (E5).
- **Design reference:** *Trail Guide Branded* in the Claude Design project. It has the editor and sample components.
- **Every guide block is movable per guide.** That includes the ones the page layout currently fixes: "Before you go", "Safety points", "Steps" and "Route map". See "Movable blocks" below.

## Goal

Writing and maintaining a hike guide should feel like writing a document, not editing files. The editor must let us use **our own components** (`<Step>`, `<RouteMap>`, `<PhotoCard>`, and later ones like an elevation profile) as first-class blocks: insert them, see them render, change their settings. Adding a new component to the site should make it available in the editor without editor work.

Strawberry Peak is the baseline. Every milestone is done when Strawberry Peak can be edited end to end with it, and the round-trip and E2E tests below pass on it.

## Where we start

`/editor` already exists (local only): CodeMirror on raw `index.mdx` and `waypoints.json`, a live preview with the real components, an insert menu driven by `src/components/mdx/registry.tsx`, autosave, and schema validation before writing. What's missing: a writing experience that isn't raw markup, settings for components, a visual way to edit pins (today it's raw JSON), creating a hike, and any way to edit outside `pnpm dev`.

## Do we need a CMS?

A CMS bundles four things: an editing UI, where content is stored, who may edit (auth), and media handling. We already have storage (MDX files in git, deployed by Vercel), media (Supabase plus the ingest pipeline) and a validated content model (zod). What we lack is the editing UI, and later, editing on the live site.

| Option | What it is | Our components in the editor | Fit |
| --- | --- | --- | --- |
| **A. Our editor + MDXEditor** (recommended) | An open-source rich-text MDX editor library (Lexical-based, v4.3, actively maintained) embedded in our `/editor` | Yes: each registry entry becomes a `jsxComponentDescriptor` with its own React editor, so blocks can render the real component | Keeps MDX files, Velite, our schemas, the map/photo tooling and the brand design. Local-only until we add a storage adapter |
| B. Keystatic | A git-based CMS from Thinkmill. Edits the same files; `github` mode commits from the deployed site | Yes: MDX "content components" (`block`, `wrapper`, `inline`) with prop schemas | A good later option for editing on the live site, but it's a second content model next to our zod schemas. Pins, the track and Supabase photos don't map onto its field types, so the map editor would still be custom, and its admin UI isn't our design |
| C. TinaCMS | A git-backed CMS with visual editing on the page | Yes: MDX templates | Needs Tina Cloud or a self-hosted backend with a database. Heavier than we need |
| D. Payload, Sanity and the like | A database or hosted CMS | Via their own block systems | Moves content out of MDX and git and drops Velite. A rewrite, not a step |

**Recommendation: A.** Build on what we have, and make the editor's storage a small adapter (local filesystem now, GitHub commits later) so editing on the live site becomes one milestone (E5) rather than a migration. Revisit Keystatic at E5 if building auth and commits ourselves looks worse.

## Core idea: one component manifest

Extend each registry entry so a single definition drives everything:

```ts
// src/components/mdx/registry.tsx (sketch)
Step: {
  component: Step,
  title: "Guide section",
  description: "Section for a pin: number, photo, your notes",
  props: z.object({ waypoint: waypointRef, hidePhoto: z.boolean().optional() }),
  children: "markdown",          // none | markdown
  category: "Guide",
  snippet: '<Step waypoint="{{waypoint}}">…</Step>',
}
```

The `props` schema then generates:

1. **The settings panel** (the component-settings panel from the design): a form per prop type, with a waypoint dropdown for `waypointRef`, toggles for booleans, number fields with ranges.
2. **The rich-text editor's block definition** (MDXEditor descriptor), with a live render of the real component inside `HikeProvider`.
3. **Build-time validation:** the remark pass checks every component's props against its schema, so a typo like `<RouteMap heigth={300} />` fails the build the way a bad waypoint id does today.
4. **The insert menu**, grouped by category, as today.

"Importing our own component" then means: build the component, add one registry entry with a props schema. It appears everywhere automatically.

### Movable blocks

Today some blocks are layout rather than content: "Before you go" always renders at the top from the `essentials` frontmatter, and the sidebar is always Minimap → Safety points → Steps (`src/components/sidebar/registry.tsx`). For them to move per guide:

- **Article blocks become registry components:** `<BeforeYouGo />` (still reading `essentials` from the frontmatter, so its data stays structured), plus `<SafetyPoints />` and `<Steps />` as inline versions of the sidebar cards. `<RouteMap />` already is one.
- **Defaults keep old guides unchanged:** if a guide doesn't place `<BeforeYouGo />`, it renders at the top as now (the same idea as auto-inserted step stubs).
- **The sidebar becomes per-guide:** an optional `sidebar: [minimap, safety, steps]` in the frontmatter (validated against the sidebar registry; the default is today's order). The editor shows it as a reorderable list.

## Milestones

**E0: Spike. ✅ Done 2026-10-01: GO.** MDXEditor 4.3.1 round-trips every guide with the same frontmatter and the same MDX syntax tree, and a second pass changes nothing. Strawberry Peak comes back byte-for-byte (apart from the final newline). Comments, numeric and boolean props, and headings, lists and links inside `<Step>` all survive. The remaining normalisations, once applied, are stable:
- children of block components are indented 2 spaces
- `_em_` becomes `*em*`
- the final newline is dropped (the save path adds it back)

`bullet: "-"` and `rule: "-"` keep our list and rule style. It renders in Next 16 dev with React 19 and Turbopack (client-only via `next/dynamic`), with no errors. The setup lives in `src/components/editor/mdx-editor-config.ts`; `src/components/editor/__tests__/roundtrip.test.tsx` runs in CI on jsdom. As expected, generic JSX blocks don't show props yet (E1) and the editor is unstyled (E2).

**E1: Component manifest, settings panel, movable blocks. ✅ Done 2026-10-02**, except two items in [todo.md](todo.md): styling the panel from *Trail Guide Branded* (no local copy of the design yet) and selecting a component by clicking it in the preview (E2's Write mode covers that). As built:
- `src/lib/mdx/manifest.ts` (pure zod) is the source of each component's props: build checks, the editor's forms, the insert-menu categories and the rich-text descriptors all read it, and the components take their prop types from it.
- `remark-component-props` and `remark-default-blocks` run in Velite, in the editor preview and in the save API (`src/lib/mdx/check.ts`), so the editor can no longer write a guide that won't build.
- The settings panel opens next to the source when the cursor is inside a component and rewrites only its opening tag (`src/components/editor/jsx-source.ts`).
- New blocks `<BeforeYouGo />`, `<SafetyPoints />`, `<Steps />`, plus frontmatter `sidebar`.
- The preview gets `track.json`, so its mileage and route match the live page.

Original scope:
- Read *Trail Guide Branded* for the editor and settings-panel design and its sample components.
- Props schemas for all registry components; build-time prop validation in the remark pass.
- Movable blocks (above): `<BeforeYouGo />`, `<SafetyPoints />`, `<Steps />` and a per-guide `sidebar` order, all with defaults so Strawberry Peak renders the same until it's edited.
- The settings panel from the design: click a component in the source or the preview and edit its props in a form.
- Fix the preview mileage bug ([todo.md](todo.md)).
- Tests: schema-to-form mapping, and prop validation on Strawberry Peak.

**E2: Write mode (if E0 is a go).**
- A "Write" tab next to "Source": rich text with headings, bold and italic, lists, links, and an "insert component" button.
- Components show as live blocks; clicking one opens the E1 settings panel. `<Step>` blocks show their pin's number, photo and caption, with editable notes inside.
- Both tabs edit the same document; autosave and validation are unchanged.

**E3: Map and pin editor** (replaces the raw `waypoints.json` tab; JSON stays available under "Advanced").
- A map with the track and pins. Drag a pin and it snaps to the track (`src/lib/track.ts`); drag the view cone to set the heading.
- Click the track to add a pin; delete pins; order follows trail mileage automatically.
- A side panel per pin: type, label, title, caption, note, and a photo picker from the hike's uploaded photos.
- E2E test: move Strawberry Peak's saddle pin and check the mileage and step order update.

**E4: Create a hike from the editor** (dev only).
- A "New hike" form generated from `frontmatterSchema`.
- Optional GPX upload (reuses `buildTrack`) and photo-folder import, with HEIC→JPEG conversion (`sips` on macOS) and the existing merge/snap ingest.
- Lands in the E3 pin editor as a draft.

**E5: Editing on the live site (in V2).**
- `/editor` runs in production behind an owner-only sign-in. The editor never needs a server filesystem: the preview already compiles in the browser.
- **Saving:** a GitHub storage adapter commits `index.mdx`/`waypoints.json` to `main` through the GitHub API, Vercel redeploys, and the change is live in about a minute. The local adapter stays for `pnpm dev`.
- **Photos are out of V2** (owner, 2026-10-01): live-site editing covers text, components and pins only; photos are still added with `pnpm ingest` on the Mac. Uploading from the phone (signed Supabase upload URLs, HEIC and iOS location handling) moved to [todo.md](todo.md).
- **Risk to spike before building:** the sign-in choice, GitHub OAuth (which also gives the token for commits) or Sign in with Vercel.
- **Fallback:** Keystatic's `github` mode if building our own auth and commits looks worse once E3 is done.

## Testing against the baseline

- **Round trip:** Strawberry Peak's `index.mdx` loaded and saved by the editor is unchanged, or changes only in an agreed normalised form.
- **E2E:** Playwright test on `/editor/strawberry-peak`: insert a component, change a setting, move a pin, save, and verify the files and the rendered page. This adds `@playwright/test` as a dev dependency (until now Playwright has only been used ad hoc from the scratchpad).
- **Unit:** manifest → form, prop validation, the pin editor's snap and reorder logic (pure functions, next to `src/lib/track.ts`).

## Open questions

- E5 sign-in: GitHub OAuth or Sign in with Vercel (decide at the E5 spike).
