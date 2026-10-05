# E2 go-live: owner steps and what to check

_Written 2026-10-05. E2's code is built and deployed, but the live site still reads guides from files and its editor is closed, because switching over needs keys and settings only the owner can provide. This page is the hand-off: what to do, in order, and what to verify afterwards._

## Where things stand

| Piece | State on 2026-10-05 |
| --- | --- |
| Database tables, lockdown rules, history | **Live** in Supabase project `fstcgdirhssuaevgxptv`. Security advisor: no findings. |
| The three guides | **Seeded** into the database (`pnpm content seed`); identical to `content/hikes`. |
| Site reading from the database | **Built, switched off.** The live site uses `CONTENT_STORE=local` (the files in the deploy). Verified locally with a production build on `CONTENT_STORE=supabase`. |
| Editor through the store, conflict detection, save guards | **Built and verified** under `pnpm dev`. |
| Google sign-in, editors list, session refresh | **Built, never run end to end.** Needs the Google client and Supabase Auth settings below. |
| Editor on the live site | **Closed** (404) until `EDITOR_AUTH=supabase` is set on Vercel. |

Nothing below is urgent: the live site works as before until you flip the switches.

## Owner steps

Do them in this order. Steps 1–5 can be tested on your Mac before the live site changes at all.

### 1. Create the Google sign-in client

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project (for example "Trailnotes"), or pick an existing one.
2. Go to **APIs & Services → OAuth consent screen** (Google now also calls this "Google Auth Platform"). Choose **External**, and fill in the app name ("Trailnotes"), your email as support and developer contact. No scopes need adding: the defaults (email, profile, openid) are all that's used.
3. Leave the app in **Testing** and add your own Google address under **Test users**. In Testing, only listed test users can sign in at all, which is an extra lock while you're the only editor. (Add a test user for each future editor, or publish the app later.)
4. Go to **Credentials → Create credentials → OAuth client ID** (or **Clients → Create client**). Application type: **Web application**.
   - **Authorized JavaScript origins:** `https://trail-notes-amber.vercel.app` and `http://localhost:3100`
   - **Authorized redirect URIs:** `https://fstcgdirhssuaevgxptv.supabase.co/auth/v1/callback`
     (Google sends people back to Supabase, and Supabase sends them on to the site.)
5. Copy the **Client ID** and **Client secret**.

### 2. Turn on Google in Supabase

In the [Supabase dashboard](https://supabase.com/dashboard/project/fstcgdirhssuaevgxptv) for the project:

1. **Authentication → Sign In / Providers → Google:** enable it, paste the Client ID and Client secret, save.
2. **Authentication → URL Configuration:**
   - **Site URL:** `https://trail-notes-amber.vercel.app`
   - **Redirect URLs:** add `https://trail-notes-amber.vercel.app/auth/callback` and `http://localhost:3100/auth/callback`

### 3. Test sign-in on your Mac

1. Add to `.env.local`:
   ```bash
   EDITOR_AUTH=supabase
   ```
   (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are already there.)
2. Run `pnpm dev` and open http://localhost:3100/sign-in. Sign in with Google.
3. You should land back on the sign-in page with **"That Google account isn't on the editors list"**. That's correct: your account now exists, but isn't an editor yet.

### 4. Put yourself on the editors list

```bash
pnpm editors add you@gmail.com --role owner
```

Sign in again at http://localhost:3100/sign-in. You should now reach `/editor`, with your name and a **Sign out** button at the top.

### 5. Close sign-ups

In Supabase, **Authentication → Sign In / Providers**, turn **off "Allow new users to sign up"**. Your account already exists, so you can still sign in; nobody new can create one. (Even with sign-ups open, a new account can do nothing until it's added with `pnpm editors add`. Closing them just keeps strangers' accounts out of the user list.)

To add another editor later: turn sign-ups on, have them sign in once, run `pnpm editors add their@email --role editor`, turn sign-ups off again. If Google is still in Testing, add them as a test user first.

### 6. Switch the live site over

In Vercel, **Project → Settings → Environment Variables**, for **Production** (and Preview if you use it):

| Name | Value | Notes |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | the service-role key from `.env.local` | Mark it **Sensitive**. This key bypasses every database rule; it must never get a `NEXT_PUBLIC_` name. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable key from `.env.local` | Public by design. |
| `CONTENT_STORE` | `supabase` | The site reads and saves guides in the database. |
| `EDITOR_AUTH` | `supabase` | Opens `/sign-in` and `/editor` to people on the editors list. |

Then **redeploy** (Deployments → the latest → Redeploy). Variables only apply to new deployments.

You can do this in two stages if you prefer: set the first three and redeploy (the site now reads from the database, editor still closed), check the site, then add `EDITOR_AUTH` and redeploy.

### 7. Optional

- **GitHub → repo Settings → Secrets and variables → Actions:** add `SUPABASE_SERVICE_ROLE_KEY`. CI then checks every stored guide on each push, so a code change that would break a stored guide is caught. Without it that step is skipped.
- **Supabase plan:** the project is on the free plan, which pauses after about a week without activity. A daily request from Vercel keeps it awake once `CONTENT_STORE=supabase` is live. A paid plan removes the risk entirely.

## What to check once the keys are in

These are the parts that could not be exercised without your keys, or that depend on a service behaving as documented. Grouped by where a problem would show.

### What you'd see in the UI

- [ ] **Sign-in page** is plain: a heading and a "Continue with Google" button in brand colours. There's no design for it.
- [ ] **After Google, you land on `/editor`.** If you land on `/sign-in?error=failed` instead, the callback couldn't complete: check the redirect URLs in step 2.
- [ ] **Your name and "Sign out"** appear in the editor's top bar and on the hike list.
- [ ] **Saving on the live site** shows "Saved …", and the public page shows the change. The first visit after a save may still get the old page while the new one is rendered; the next visit gets the new one.
- [ ] **A draft has no public page.** "Preview page ↗" on a draft opens a 404 on the live site; the editor's own preview pane is the only preview of a draft.
- [ ] **Conflict banner:** open the same hike in two tabs, save in one, then edit in the other. The second tab must say the guide changed and must not save. "Reload" discards that tab's unsaved text, so copy it first.
- [ ] **Signed out mid-edit:** if the session ends while you type, the next save reports that you're no longer signed in. Your text stays in the tab; sign in in another tab and press Save.
- [ ] **On a phone** the editor is the three-column desktop layout, squeezed. It works, but it isn't designed for a phone yet (open question in [v2-plan.md](v2-plan.md)).

### Technical

- [ ] **Google sign-in has never run end to end.** The moving parts: `/auth/sign-in` starts it and stores a one-time verifier in a cookie; Google returns to Supabase, then to `/auth/callback`, which swaps the code for a session. If the verifier cookie doesn't survive the round trip, the callback fails.
- [ ] **Session refresh** (`src/proxy.ts`) hasn't seen a real token. Symptom if it's wrong: you're signed out after about an hour even while active.
- [ ] **The site's address behind Vercel:** the sign-in and callback routes build redirect URLs from the request's own address. Check that after signing in on the live site you end up on `trail-notes-amber.vercel.app`, not a `*.vercel.app` deployment address.
- [ ] **Page refresh after a save** (`revalidatePath`) is only proven under `pnpm dev`, where nothing is cached. On the live site, confirm a saved, published change appears without a redeploy.
- [ ] **A brand-new hike gets a page without a deploy:** seed or create a published hike and open `/hikes/<slug>`.
- [ ] **The daily keep-alive** shows under the project's Cron Jobs in Vercel, and `/api/health` reports `"store":"supabase"`.
- [ ] **If the database is unreachable**, cached pages should keep being served. Untested; the only way to test it is to pause the project.
- [ ] **The build now needs the database.** With `CONTENT_STORE=supabase`, a build reads guides from Supabase. If the key is missing or the project is paused, the build fails (the previous deployment stays live). That is intended, but it is a new way for a deploy to fail.
- [ ] **Every autosave is a history row.** Typing for an hour writes a lot of rows to `hike_revisions`. Fine at this size; pruning or coarser history is a later job.
- [ ] **The rate limit is per server instance** (60 saves a minute per editor). It stops a runaway tab, not a determined attacker; the real protection is that only listed editors can save at all.

### Dependencies and things that can drift

- [ ] **`content/hikes` and the database are now two copies.** After the switch the database is what the site shows; the repo copy is seed data and the test baseline. Edits made in the live editor don't appear in the repo until `pnpm content pull`. `pnpm content seed` refuses to overwrite a stored guide that differs unless `--force`.
- [ ] **`pnpm ingest` and `pnpm gpx` write to files unless told otherwise.** After the switch, use `--guides supabase` to change what the live site shows.
- [ ] **`pnpm photos check` reads the repo's copy of the guides**, not the database, so it won't notice a photo referenced only by a guide edited live.
- [ ] **Google in Testing mode** only lets listed test users in. A new editor who isn't a test user gets Google's own error page, before our "not on the editors list" message.
- [ ] **Supabase links a Google sign-in to an existing account by email.** Step 3 creates the account by signing in, so this isn't relied on; it matters only if you ever create users by hand in the dashboard.
- [ ] **Supabase free plan:** pauses when idle; the keep-alive depends on Vercel's daily cron running.
- [ ] **Supabase contract tests run against the real project** (there's no Docker on the Mac for a local database). They use `zz-contract-*` draft rows and delete them, and only run with `SUPABASE_CONTRACT_TESTS=1`.

## Decisions made while you were away

Each is reversible; say so if you'd rather have it another way.

- **Velite is removed.** The site renders every guide through one path (store → server compile). `pnpm content check` replaces its build-time check.
- **Two explicit switches** (`CONTENT_STORE`, `EDITOR_AUTH`) instead of "use the database if a key is present", so a missing key is a loud error and the two changes can go live separately.
- **Pins and the track are stored as `json`, not `jsonb`,** so they read back exactly as written.
- **Raw HTML is refused in guides**, except `br`, `sub`, `sup`, `kbd`, `mark`, `details`, `summary` without attributes. Everything else must be a component.
- **Outsiders get a 404 everywhere** on the editor, and the sign-in page lives at `/sign-in` (it has to be reachable by someone who isn't signed in).
- **`package.json` is now `"type": "module"`,** needed for scripts to load the MDX compiler.
- **`pnpm gpx` on a new slug creates a draft hike** with the route's stats filled in, since a track can no longer exist without a guide.
