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

/** What Supabase provides and the migrations refer to: the browser roles and auth.users. */
const SUPABASE_STANDINS = `
  do $$ begin create role anon; exception when duplicate_object then null; end $$;
  do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key);
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
    const sp = { mdx: readFileSync("content/hikes/strawberry-peak/index.mdx", "utf8"), waypoints: readFileSync("content/hikes/strawberry-peak/waypoints.json", "utf8") };
    const draftOf = (slug: string) => sp.mdx.replace("slug: strawberry-peak", `slug: ${slug}`).replace(/^date:/m, "draft: true\ndate:");

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
  });
} else {
  describe.skip("ContentStore contract: Postgres (set TEST_DATABASE_URL to run)", () => {
    it("skipped", () => {});
  });
}
