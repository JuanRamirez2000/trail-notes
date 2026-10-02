# Changelog

Newest first. Commit hashes refer to `main`.

## V1 (2026-09-30 → 2026-10-01): groundwork, real data, Strawberry Peak

**Goal:** publish real hikes. Scope moved during the version: the planned map editor (M3) and elevation profile (M4) are now part of V2 / [todo.md](todo.md).

- **Tests and CI** (`32ab198`, `f848a5e`): Vitest suite and a GitHub Actions workflow. Pure script logic moved to `scripts/lib/` so it can be tested. `pnpm typecheck` runs `next typegen`.
- **Photos only in Supabase** (`32ab198`): `public/photos` untracked, dev-only local backend, production guard, `pnpm photos check|push|pull`.
- **Dev refresh fix** (`32ab198`): editing `waypoints.json`/`track.json` recompiles the post. This also fixed Velite's watcher not starting under Next 16.3 (argv vs `NODE_ENV`).
- **GPX parser fix** (`32ab198`): points written `lon` before `lat`, or self-closing, were dropped.
- **Samples set to drafts** (`32ab198`): `ridgeline-loop`, `granite-saddle`.
- **Track projection and merging ingest** (`4b187b0`): `src/lib/track.ts`. Ingest merges into existing waypoints, skips photos already ingested, continues the numbering, snaps to the track, and reports off-track and out-of-order photos.
- **Map render hygiene** (`42ad248`): memoised pins, cached CSS colour tokens.
- **Strawberry Peak published** (`f575ba6`, `aa9298f`): 6 pins at GPX breakpoints with one photo each, text from the recording, no duplicate views. Track matching slack now scales with distance from the track.
- **Docs:** [backlog.md](backlog.md) (auto node placement, several photos per point) and this knowledge folder.

## V0 (before 2026-09-30): scaffold

`78b6a18` → `693784d`. MDX hike guides with photo-derived waypoints, the Velite content layer, the Mapbox and sketch maps within WebGL limits, guide sections per pin with sidebar quick links and scrollspy, safety/landmark/ranger pins, the detailed `granite-saddle` sample, GPX support, the local `/editor` (CodeMirror + live preview + autosave), and a branded 404.
