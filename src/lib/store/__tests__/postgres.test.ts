import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, describe, expect, it } from "vitest";
import { connect, type Database } from "../../../db/client";
import { hikeRevisions } from "../../../db/schema";
import { postgresBackend } from "../postgres";
import { createStore } from "../store";
import { describeStoreContract } from "./contract";

/**
 * The store contract against a real Postgres, with the tables made by the migrations in drizzle/.
 * CI runs it against a throwaway Postgres service; locally, point TEST_DATABASE_URL at a scratch
 * database (`createdb trailnotes_test`). Never at the real project: it creates tables.
 *
 *   TEST_DATABASE_URL=postgres://postgres@localhost:5432/trailnotes_test pnpm test postgres
 */
const url = process.env.TEST_DATABASE_URL;
if (url && /supabase\.(co|com)/.test(url)) throw new Error("TEST_DATABASE_URL points at Supabase. Use a scratch database: this suite creates tables.");

/** What Supabase provides and the migrations refer to: the browser roles, auth.users, auth.uid() and storage.objects. */
const SUPABASE_STANDINS = `
  do $$ begin create role anon; exception when duplicate_object then null; end $$;
  do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key);
  -- Supabase reads the signed-in user's id from the request's JWT; the tests set it by hand.
  create or replace function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
  create schema if not exists storage;
  create table if not exists storage.objects (bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema public, storage to anon, authenticated;
  grant select, insert, delete on storage.objects to anon, authenticated;
`;

let db: Database | undefined;
async function database() {
  if (!db) {
    db = connect(url!, { idleSeconds: 1 });
    await db.$client.unsafe(SUPABASE_STANDINS);
    await migrate(db, { migrationsFolder: "drizzle" });
  }
  return db;
}

if (url) {
  afterAll(async () => db?.$client.end());

  describeStoreContract("Postgres (Drizzle)", async () => createStore(postgresBackend(await database())), "zz-contract-postgres");

  describe("Postgres: history and lockdown", () => {
    const sp = { mdx: readFileSync("fixtures/hikes/cedar-ridge/index.mdx", "utf8"), waypoints: readFileSync("fixtures/hikes/cedar-ridge/waypoints.json", "utf8") };
    const draftOf = (slug: string) => sp.mdx.replace("slug: cedar-ridge", `slug: ${slug}`);

    it("records every save in the history table, with who made it", async () => {
      const store = createStore(postgresBackend(await database()));
      const slug = "zz-contract-history";
      await store.remove(slug);
      const mdx = draftOf(slug);
      const created = await store.create(slug, { mdx, waypoints: sp.waypoints }, { editor: null });
      await store.save(slug, { mdx: mdx.replace("7.3 miles", "7.4 miles"), waypoints: sp.waypoints }, {
        editor: { id: "00000000-0000-4000-8000-000000000009", name: "Tester", email: "tester@example.test", role: "owner" },
        baseVersion: created.ok ? created.version : "",
      });
      const rows = await (await database())
        .select({ version: hikeRevisions.version, savedBy: hikeRevisions.savedBy, savedByLabel: hikeRevisions.savedByLabel })
        .from(hikeRevisions)
        .where(sql`${hikeRevisions.slug} = ${slug}`)
        .orderBy(hikeRevisions.version);
      expect(rows).toEqual([
        { version: 1, savedBy: null, savedByLabel: "script" },
        { version: 2, savedBy: "00000000-0000-4000-8000-000000000009", savedByLabel: "tester@example.test" },
      ]);
      await store.remove(slug);
    });

    it("gives the browser roles nothing: no rows, no writes", async () => {
      const store = createStore(postgresBackend(await database()));
      const slug = "zz-contract-lockdown";
      await store.remove(slug);
      await store.create(slug, { mdx: draftOf(slug), waypoints: sp.waypoints }, { editor: null });
      const client = (await database()).$client;
      await client.unsafe("grant usage on schema public to anon; grant select, insert on public.hikes to anon");
      const asAnon = (query: string) =>
        client.begin(async (tx) => {
          await tx.unsafe("set local role anon");
          return [...(await tx.unsafe(query))];
        });
      expect(await asAnon("select slug from public.hikes")).toHaveLength(0);
      await expect(asAnon("insert into public.hikes (slug, mdx, waypoints, details, status) values ('zz-anon', 'x', '{}', '{}', 'published')")).rejects.toThrow(/row-level security/);
      await store.remove(slug);
    });

    it("lets people on the editors list, and nobody else, add, list and delete hike photos", async () => {
      const client = (await database()).$client;
      const EDITOR = "00000000-0000-4000-8000-0000000000e1";
      const STRANGER = "00000000-0000-4000-8000-0000000000e2";
      await client.unsafe(`
        delete from storage.objects;
        -- As on Supabase: the browser roles may query public tables, and row-level security decides what they get.
        grant select on public.editors to authenticated;
        insert into auth.users (id) values ('${EDITOR}'), ('${STRANGER}') on conflict do nothing;
        insert into public.editors (user_id, role) values ('${EDITOR}', 'editor') on conflict do nothing;
      `);
      // A signed-in request, as Supabase runs it: the authenticated role, with the user's id from the JWT.
      const as = (user: string | null, query: string) =>
        client.begin(async (tx) => {
          if (user) await tx.unsafe(`select set_config('request.jwt.claim.sub', '${user}', true)`);
          await tx.unsafe(`set local role ${user ? "authenticated" : "anon"}`);
          return [...(await tx.unsafe(query))];
        });
      const add = (bucket: string, name: string) => `insert into storage.objects (bucket_id, name) values ('${bucket}', '${name}')`;

      await as(EDITOR, add("hikes", "zz/01-a.full.webp"));
      expect(await as(EDITOR, "select name from storage.objects")).toHaveLength(1);
      await expect(as(EDITOR, add("another-bucket", "x.webp"))).rejects.toThrow(/row-level security/);

      // Signed in is not enough, and neither is no sign-in at all.
      for (const who of [STRANGER, null]) {
        await expect(as(who, add("hikes", "zz/02-b.full.webp"))).rejects.toThrow(/row-level security/);
        expect(await as(who, "select name from storage.objects")).toHaveLength(0);
        await as(who, "delete from storage.objects");
      }
      expect(await client.unsafe("select name from storage.objects")).toHaveLength(1);

      // The check gives away nothing but yes or no, and the list itself stays closed.
      expect(await as(STRANGER, "select public.is_editor() as ok")).toEqual([{ ok: false }]);
      expect(await as(EDITOR, "select public.is_editor() as ok")).toEqual([{ ok: true }]);
      expect(await as(EDITOR, "select * from public.editors")).toHaveLength(0);
      await expect(as(null, "select public.is_editor()")).rejects.toThrow(/permission denied/);

      await as(EDITOR, "delete from storage.objects");
      expect(await client.unsafe("select name from storage.objects")).toHaveLength(0);
      await client.unsafe(`delete from public.editors where user_id = '${EDITOR}'; delete from auth.users where id in ('${EDITOR}', '${STRANGER}')`);
    });
  });
} else {
  describe.skip("ContentStore contract: Postgres (set TEST_DATABASE_URL to run)", () => {
    it("skipped", () => {});
  });
}
