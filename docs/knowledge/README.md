# Shared knowledge

The working memory of this project, written for whoever picks it up next: the owner, a collaborator, or a future coding agent session. `CLAUDE.md` imports this file, so agents see it on every session.

**Read [current.md](current.md) before changing anything.** It describes how the project works today, including the decisions and gotchas that the code alone doesn't explain.

| File | What it holds | Update it when |
| --- | --- | --- |
| [current.md](current.md) | The version that's live, the architecture, conventions, the baseline hike, decisions and gotchas | Behaviour, structure or a convention changes |
| [changelog.md](changelog.md) | What each version added, with commits | Anything ships to `main` |
| [todo.md](todo.md) | Known issues and TODOs, grouped by the version they belong to | You find a problem you won't fix now, or finish one |
| [backlog.md](backlog.md) | Unscheduled feature ideas, written up in enough detail to build | An idea comes up that isn't planned yet |
| [v0.1-plan.md](v0.1-plan.md) | The scope and steps of the first tagged release, `v0.1.0` | A step ships; delete the file once the tag is cut |
| [v2-plan.md](v2-plan.md) | The plan for the version in progress (V2: editing) | The plan changes, or a milestone ships |
| [e2-go-live.md](e2-go-live.md) | The owner's steps to switch the live site to Supabase and Google sign-in, and what to check afterwards | A step is done or checked; delete the file once E2 is fully live |

Rules for keeping it useful:

- **Facts, not intentions.** Write down what's true now, and move it to `changelog.md` once it's history. Delete what's no longer true; don't leave it as "~~old~~".
- **Say why.** For each decision or gotcha, note the reason or the evidence (a measurement, a commit, an error message) so a later reader can tell when it stops applying.
- **One place per fact.** Link instead of copying. `README.md` (repo root) is the user guide for running and authoring; these files are about the project's state and direction.
- **Dates are absolute** (2026-10-01, not "yesterday").
