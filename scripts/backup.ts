/**
 * Backs up everything in the database that can't be made again: every guide (working copy,
 * published copy, route), every saved version, and the editors list. Photos are not copied; the
 * backup lists which photo files existed.
 *
 *   pnpm backup [--to <folder>] [--keep <n>]   write a dated backup, then drop all but the newest n (default 30)
 *   pnpm backup schedule                       run it every day at 09:00 on this Mac (a launchd agent)
 *   pnpm backup unschedule                     stop that
 *
 * Backups go to BACKUP_DIR, else ~/Backups/trailnotes, one folder per run:
 *
 *   2026-10-09_0900/
 *     hikes/<slug>/     the guide as files, the layout the file store reads
 *     history/<slug>.json   every saved version, oldest first
 *     editors.json, photos.json, manifest.json
 *
 * To put guides back: CONTENT_DIR=<backup>/hikes pnpm content seed [slug] [--force]
 * (history isn't restored by that; it's there to recover an older version by hand).
 *
 * Needs DATABASE_URL (.env.local). It only reads.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { asc, eq, sql } from "drizzle-orm";
import { authUsers } from "drizzle-orm/supabase";
import { editors, hikeRevisions } from "../src/db/schema";
import { PHOTO_BUCKET } from "../src/lib/storage";
import { localBackend } from "../src/lib/store/local";
import { postgresBackend } from "../src/lib/store/postgres";
import { createStore } from "../src/lib/store/store";
import { waypointsText } from "../src/lib/store/validate";
import { scriptDatabase } from "./lib/stores";

try {
  process.loadEnvFile(".env.local");
} catch {
  // optional
}

const { values, positionals } = parseArgs({ allowPositionals: true, options: { to: { type: "string" }, keep: { type: "string", default: "30" } } });
const dest = path.resolve((values.to ?? process.env.BACKUP_DIR ?? path.join(homedir(), "Backups/trailnotes")).replace(/^~(?=\/)/, homedir()));
const STAMP = /^\d{4}-\d{2}-\d{2}_\d{4}$/;

const json = (data: unknown) => `${JSON.stringify(data, null, 2)}\n`;

async function backup() {
  const keep = Number(values.keep);
  if (!Number.isInteger(keep) || keep < 1) throw new Error("--keep must be a whole number, 1 or more");
  const db = scriptDatabase("pnpm backup");
  const store = createStore(postgresBackend(db));

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  const dir = path.join(dest, stamp);
  // Written under a temporary name and renamed at the end, so a folder with a date is always a whole backup.
  const tmp = `${dir}.partial`;
  await rm(tmp, { recursive: true, force: true });

  const hikes = await store.list();
  let revisions = 0;
  for (const { slug } of hikes) {
    const h = (await store.read(slug))!;
    const d = path.join(tmp, "hikes", slug);
    await mkdir(d, { recursive: true });
    await writeFile(path.join(d, "index.mdx"), h.mdx);
    await writeFile(path.join(d, "waypoints.json"), h.waypoints);
    if (h.track) await writeFile(path.join(d, "track.json"), `${JSON.stringify(h.track)}\n`);
    if (h.published) {
      await mkdir(path.join(d, "published"), { recursive: true });
      await writeFile(path.join(d, "published/index.mdx"), h.published.mdx);
      await writeFile(path.join(d, "published/waypoints.json"), h.published.waypoints);
    }
    if (h.deleteAfter) await writeFile(path.join(d, ".delete-after"), `${h.deleteAfter}\n`);

    const saved = await db.select().from(hikeRevisions).where(eq(hikeRevisions.slug, slug)).orderBy(asc(hikeRevisions.version));
    revisions += saved.length;
    await mkdir(path.join(tmp, "history"), { recursive: true });
    await writeFile(
      path.join(tmp, "history", `${slug}.json`),
      json(saved.map((r) => ({ version: r.version, savedAt: r.savedAt.toISOString(), savedBy: r.savedByLabel, status: r.status, mdx: r.mdx, waypoints: waypointsText(r.waypoints) }))),
    );
  }

  const people = await db.select({ email: authUsers.email, role: editors.role, userId: editors.userId }).from(editors).leftJoin(authUsers, eq(authUsers.id, editors.userId)).orderBy(asc(editors.createdAt));
  await writeFile(path.join(tmp, "editors.json"), json(people));
  const photos = (await db.execute<{ name: string }>(sql`select name from storage.objects where bucket_id = ${PHOTO_BUCKET} order by name`)).map((r) => r.name);
  await writeFile(path.join(tmp, "photos.json"), json(photos));

  // Read it back the way a restore would, so a backup that can't be read fails here and not on the day it's needed.
  const written = await createStore(localBackend(path.join(tmp, "hikes"))).list().catch(() => []);
  const unreadable = hikes.filter((h) => !written.some((w) => w.slug === h.slug && w.details !== null));
  if (hikes.length && unreadable.length) throw new Error(`The backup didn't read back for: ${unreadable.map((h) => h.slug).join(", ")}. Nothing was kept.`);

  await writeFile(path.join(tmp, "manifest.json"), json({ at: now.toISOString(), guides: hikes.map((h) => ({ slug: h.slug, status: h.status, deleteAfter: h.deleteAfter })), revisions, editors: people.length, photoFiles: photos.length, photosIncluded: false }));
  await rm(dir, { recursive: true, force: true });
  await rename(tmp, dir);

  const all = (await readdir(dest)).filter((n) => STAMP.test(n)).sort();
  const old = all.slice(0, Math.max(0, all.length - keep));
  for (const n of old) await rm(path.join(dest, n), { recursive: true, force: true });

  console.log(`✓ ${hikes.length} guide(s), ${revisions} saved version(s), ${people.length} editor(s) → ${dir}`);
  console.log(`  photos are not in the backup (${photos.length} files are listed in photos.json)`);
  if (old.length) console.log(`  dropped ${old.length} older backup(s); ${all.length - old.length} kept`);
}

// ── The daily schedule: a launchd agent for this user ────────────────────────
const LABEL = "app.trailnotes.backup";
const PLIST = path.join(homedir(), "Library/LaunchAgents", `${LABEL}.plist`);
const LOG = path.join(dest, "backup.log");

async function schedule() {
  const repo = process.cwd();
  // launchd starts with a bare PATH, so the plist names the programs by where they are today.
  const pnpm = execFileSync("which", ["pnpm"], { encoding: "utf8" }).trim();
  const nodeDir = path.dirname(process.execPath);
  await mkdir(dest, { recursive: true });
  await mkdir(path.dirname(PLIST), { recursive: true });
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  await writeFile(
    PLIST,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>WorkingDirectory</key><string>${esc(repo)}</string>
  <key>ProgramArguments</key>
  <array><string>${esc(pnpm)}</string><string>backup</string><string>--to</string><string>${esc(dest)}</string></array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>${esc(`${nodeDir}:${path.dirname(pnpm)}:/usr/bin:/bin`)}</string></dict>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>${esc(LOG)}</string>
  <key>StandardErrorPath</key><string>${esc(LOG)}</string>
</dict>
</plist>
`,
  );
  const uid = process.getuid!();
  try {
    execFileSync("launchctl", ["bootout", `gui/${uid}/${LABEL}`], { stdio: "ignore" });
  } catch {
    // not loaded yet
  }
  execFileSync("launchctl", ["bootstrap", `gui/${uid}`, PLIST]);
  console.log(`✓ a backup runs every day at 09:00 (or when the Mac next wakes) → ${dest}\n  log: ${LOG}\n  to run it now: launchctl kickstart gui/${uid}/${LABEL}`);
}

async function unschedule() {
  try {
    execFileSync("launchctl", ["bootout", `gui/${process.getuid!()}/${LABEL}`], { stdio: "ignore" });
  } catch {
    // wasn't loaded
  }
  if (existsSync(PLIST)) await rm(PLIST);
  console.log("✓ the daily backup is off (existing backups are untouched)");
}

const commands: Record<string, () => Promise<void>> = { schedule, unschedule };
const command = positionals[0] ? commands[positionals[0]] : backup;
if (!command) {
  console.error("Usage: pnpm backup [--to <folder>] [--keep <n>] | pnpm backup schedule | pnpm backup unschedule");
  process.exit(1);
}
command().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
