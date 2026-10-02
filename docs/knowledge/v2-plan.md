# V2 plan: editing

_Drafted 2026-10-01. Status: **agreed** (owner answers below). Next: E0._

## Decisions (owner, 2026-10-01)

- **Writing:** a rich-text "Write" mode (E0 spike → E2), with Markdown source kept as a second tab.
- **Live-site editing is in V2** (E5), including from the phone.
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

**E0: Spike (1–2 days, go/no-go).** Load MDXEditor in `/editor` on Strawberry Peak and `granite-saddle`. Check the round trip (load, save, diff): frontmatter, `<Step>` with and without children, `{/* comments */}`, blank lines, lists. Write a round-trip test that runs in CI.
- **Go:** E2 builds on MDXEditor.
- **No-go** (it rewrites our MDX in ways we can't accept): keep CodeMirror as the only text editor and do E1, E3 and E4 anyway. They meet the "own components" requirement without WYSIWYG.

**E1: Component manifest, settings panel, movable blocks.**
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
- **Photos from the phone:** the browser uploads to Supabase through short-lived signed upload URLs issued by a server route. This needs a server-only Supabase key on Vercel (until now the rule was "never on Vercel"); it never reaches the client.
- **Risks to spike before building:**
  - iOS Safari may convert HEIC to JPEG, and may strip location from photos picked in the browser. If so, GPS has to be read on the device before upload, or the pin placed on the map instead.
  - sharp can't decode HEIC on the server.
  - The auth choice: GitHub OAuth (it also gives the token for commits) or Sign in with Vercel.
- **Fallback:** Keystatic's `github` mode if building our own auth and commits looks worse once E3 is done.

## Testing against the baseline

- **Round trip:** Strawberry Peak's `index.mdx` loaded and saved by the editor is unchanged, or changes only in an agreed normalised form.
- **E2E:** Playwright test on `/editor/strawberry-peak`: insert a component, change a setting, move a pin, save, and verify the files and the rendered page. This adds `@playwright/test` as a dev dependency (until now Playwright has only been used ad hoc from the scratchpad).
- **Unit:** manifest → form, prop validation, the pin editor's snap and reorder logic (pure functions, next to `src/lib/track.ts`).

## Open questions

- E5 sign-in: GitHub OAuth or Sign in with Vercel (decide at the E5 spike).
