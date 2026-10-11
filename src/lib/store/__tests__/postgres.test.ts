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

    it("lets editors add, list and delete any hike's photos, a guest only their own hikes', and nobody else any", async () => {
      const store = createStore(postgresBackend(await database()));
      const client = (await database()).$client;
      const EDITOR = "00000000-0000-4000-8000-0000000000e1";
      const STRANGER = "00000000-0000-4000-8000-0000000000e2";
      const GUEST = "00000000-0000-4000-8000-0000000000e3";
      const [MINE, OTHER] = ["zz-contract-guest-hike", "zz-contract-other-hike"];
      for (const slug of [MINE, OTHER]) {
        await store.remove(slug);
        await store.create(slug, { mdx: draftOf(slug), waypoints: sp.waypoints }, { editor: null });
      }
      await client.unsafe(`
        delete from storage.objects;
        -- As on Supabase: the browser roles may query public tables, and row-level security decides what they get.
        grant select on public.editors, public.hike_guests to authenticated;
        insert into auth.users (id) values ('${EDITOR}'), ('${STRANGER}'), ('${GUEST}') on conflict do nothing;
        insert into public.editors (user_id, role) values ('${EDITOR}', 'editor'), ('${GUEST}', 'guest') on conflict do nothing;
        insert into public.hike_guests (slug, user_id) values ('${MINE}', '${GUEST}') on conflict do nothing;
      `);
      // A signed-in request, as Supabase runs it: the authenticated role, with the user's id from the JWT.
      const as = (user: string | null, query: string) =>
        client.begin(async (tx) => {
          if (user) await tx.unsafe(`select set_config('request.jwt.claim.sub', '${user}', true)`);
          await tx.unsafe(`set local role ${user ? "authenticated" : "anon"}`);
          return [...(await tx.unsafe(query))];
        });
      const add = (bucket: string, name: string) => `insert into storage.objects (bucket_id, name) values ('${bucket}', '${name}')`;
      const names = async (user: string | null) => (await as(user, "select name from storage.objects order by name")).map((r) => r.name);

      // An editor: any hike's folder, in this bucket only.
      await as(EDITOR, add("hikes", `${MINE}/01-a.full.webp`));
      await as(EDITOR, add("hikes", `${OTHER}/01-b.full.webp`));
      await expect(as(EDITOR, add("another-bucket", "x.webp"))).rejects.toThrow(/row-level security/);
      expect(await names(EDITOR)).toEqual([`${MINE}/01-a.full.webp`, `${OTHER}/01-b.full.webp`]);

      // A guest: their own hike's folder, and nothing of anyone else's, not even to look.
      await as(GUEST, add("hikes", `${MINE}/02-c.full.webp`));
      await expect(as(GUEST, add("hikes", `${OTHER}/02-d.full.webp`))).rejects.toThrow(/row-level security/);
      // A path that only starts like their folder's name isn't in it.
      await expect(as(GUEST, add("hikes", `${MINE}-2/01-e.full.webp`))).rejects.toThrow(/row-level security/);
      expect(await names(GUEST)).toEqual([`${MINE}/01-a.full.webp`, `${MINE}/02-c.full.webp`]);
      await as(GUEST, "delete from storage.objects");
      expect(await names(EDITOR)).toEqual([`${OTHER}/01-b.full.webp`]);

      // Signed in is not enough, and neither is no sign-in at all.
      for (const who of [STRANGER, null]) {
        await expect(as(who, add("hikes", `${MINE}/03-f.full.webp`))).rejects.toThrow(/row-level security/);
        expect(await names(who)).toEqual([]);
        await as(who, "delete from storage.objects");
      }
      expect(await client.unsafe("select name from storage.objects")).toHaveLength(1);

      // The checks give away nothing but yes or no, and the lists themselves stay closed.
      expect(await as(STRANGER, "select public.is_editor() as ok")).toEqual([{ ok: false }]);
      expect(await as(EDITOR, "select public.is_editor() as ok")).toEqual([{ ok: true }]);
      expect(await as(GUEST, `select public.can_edit_hike('${MINE}') as mine, public.can_edit_hike('${OTHER}') as other`)).toEqual([{ mine: true, other: false }]);
      expect(await as(EDITOR, "select * from public.editors")).toHaveLength(0);
      expect(await as(GUEST, "select * from public.hike_guests")).toHaveLength(0);
      await expect(as(null, "select public.is_editor()")).rejects.toThrow(/permission denied/);
      await expect(as(null, `select public.can_edit_hike('${MINE}')`)).rejects.toThrow(/permission denied/);

      // A hike that's removed takes its guests' claim on it along.
      await store.remove(MINE);
      expect(await client.unsafe(`select 1 from public.hike_guests where slug = '${MINE}'`)).toHaveLength(0);

      await store.remove(OTHER);
      await client.unsafe(`delete from storage.objects; delete from public.editors where user_id in ('${EDITOR}', '${GUEST}'); delete from auth.users where id in ('${EDITOR}', '${STRANGER}', '${GUEST}')`);
    });
  });
} else {
  describe.skip("ContentStore contract: Postgres (set TEST_DATABASE_URL to run)", () => {
    it("skipped", () => {});
  });
}
