import { sql } from "drizzle-orm";
import { bigint, check, foreignKey, index, integer, json, jsonb, pgPolicy, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { anonRole, authenticatedRole, authUsers } from "drizzle-orm/supabase";
import type { Frontmatter, Track } from "../lib/schemas";

/**
 * The database, in TypeScript. This file is the source of truth for the tables: change it, then
 * `pnpm db:generate` writes the SQL migration into `drizzle/` (see docs/knowledge/current.md for how
 * one is applied). The guide store reads and writes through these definitions (src/lib/store/postgres.ts).
 *
 * Access model: only the site's server reads or writes these tables. Row-level security is on, and a
 * restrictive "server only" policy shuts out the public key and signed-in browser sessions, so no
 * one can read drafts or write around the app's save gate. The server connects as the database owner.
 */

/** Browser roles get nothing, ever. (A policy belongs to one table, so each table makes its own.) */
const serverOnly = () => pgPolicy("server only", { as: "restrictive", for: "all", to: [anonRole, authenticatedRole], using: sql`false`, withCheck: sql`false` });

export const hikes = pgTable(
  "hikes",
  {
    slug: text().primaryKey(),
    /** The guide: frontmatter + MDX body. */
    mdx: text().notNull(),
    /** `{ "waypoints": [...] }`. `json`, not `jsonb`: jsonb reorders keys, and pins must read back as written. */
    waypoints: json().notNull(),
    /** The recorded route: positions and elevation only. */
    track: json().$type<Track>(),
    /** The validated frontmatter, for lists. */
    details: jsonb().$type<Frontmatter>().notNull(),
    status: text().$type<"draft" | "published">().notNull(),
    /** Bumped on every save; a save must name the version it's based on. */
    version: integer().notNull().default(1),
    /** Auth user id; null for scripts and the local dev owner. */
    updatedBy: uuid("updated_by"),
    updatedByLabel: text("updated_by_label"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("hikes_slug_check", sql`${t.slug} ~ '^[a-z0-9-]+$'`), check("hikes_status_check", sql`${t.status} = ANY (ARRAY['draft'::text, 'published'::text])`), serverOnly()],
).enableRLS();

/** Every save, as it was saved. No foreign key to `hikes`: a row is written in the same transaction as the save. */
export const hikeRevisions = pgTable(
  "hike_revisions",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    slug: text().notNull(),
    version: integer().notNull(),
    mdx: text().notNull(),
    waypoints: json().notNull(),
    status: text().$type<"draft" | "published">().notNull(),
    savedBy: uuid("saved_by"),
    savedByLabel: text("saved_by_label"),
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("hike_revisions_slug_version_key").on(t.slug, t.version), index("hike_revisions_slug_idx").on(t.slug, t.version.desc().nullsFirst()), serverOnly()],
).enableRLS();

/** People allowed to use the editor. Being signed in is not enough: the app looks you up here. */
export const editors = pgTable(
  "editors",
  {
    userId: uuid("user_id").primaryKey(),
    role: text().$type<"owner" | "editor">().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ name: "editors_user_id_fkey", columns: [t.userId], foreignColumns: [authUsers.id] }).onDelete("cascade"),
    check("editors_role_check", sql`${t.role} = ANY (ARRAY['owner'::text, 'editor'::text])`),
    serverOnly(),
  ],
).enableRLS();
