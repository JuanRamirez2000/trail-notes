/**
 * Who may use the editor on the live site.
 *
 *   pnpm editors list
 *   pnpm editors add <email> [--role owner|editor|guest] [--hike <slug>]   the person must already have an account (see below)
 *   pnpm editors grant <email> --hike <slug>     give a guest another hike
 *   pnpm editors revoke <email> --hike <slug>    take one away
 *   pnpm editors remove <email>
 *
 * Being signed in is not enough to edit: the site looks the user up in the `editors` table.
 * An owner or editor may edit every hike. A guest may create hikes and edit, publish and delete
 * their own: the ones they created and the ones given to them here.
 *
 * This script only manages those lists. It never creates accounts: with sign-ups closed, add the
 * person under Authentication → Users in the Supabase dashboard first (same email as their Google
 * account); their first Google sign-in then attaches to that user.
 * Needs DATABASE_URL (.env.local). Accounts are looked up read-only in Supabase's auth.users.
 */
import { parseArgs } from "node:util";
import { and, asc, eq, sql } from "drizzle-orm";
import { authUsers } from "drizzle-orm/supabase";
import { editors, hikeGuests, hikes } from "../src/db/schema";
import { scriptDatabase } from "./lib/stores";

try {
  process.loadEnvFile(".env.local");
} catch {
  // optional
}

const { values, positionals } = parseArgs({ allowPositionals: true, options: { role: { type: "string", default: "editor" }, hike: { type: "string" } } });
const [cmd, email] = positionals;

async function main() {
  const db = scriptDatabase("pnpm editors");

  if (cmd === "list") {
    const rows = await db.select({ role: editors.role, email: authUsers.email, userId: editors.userId }).from(editors).leftJoin(authUsers, eq(authUsers.id, editors.userId)).orderBy(asc(editors.createdAt));
    if (!rows.length) console.log("No editors yet. Add one with: pnpm editors add <email> --role owner");
    const given = await db.select().from(hikeGuests).orderBy(asc(hikeGuests.slug));
    for (const row of rows) {
      const theirs = given.filter((g) => g.userId === row.userId).map((g) => g.slug);
      console.log(`  ${row.role.padEnd(6)} ${row.email ?? row.userId}${row.role === "guest" ? `  hikes: ${theirs.join(", ") || "none yet"}` : ""}`);
    }
    return;
  }

  const usage = "Usage: pnpm editors <list | add <email> [--role owner|editor|guest] [--hike <slug>] | grant <email> --hike <slug> | revoke <email> --hike <slug> | remove <email>>";
  if (!email || !["add", "remove", "grant", "revoke"].includes(cmd)) throw new Error(usage);
  const role = values.role;
  if (role !== "owner" && role !== "editor" && role !== "guest") throw new Error('--role must be "owner", "editor" or "guest"');
  const [user] = await db.select({ id: authUsers.id }).from(authUsers).where(sql`lower(${authUsers.email}) = ${email.toLowerCase()}`);
  if (!user) throw new Error(`No account for ${email}. Add the user in the Supabase dashboard (Authentication → Users) first.`);

  const give = async (slug: string) => {
    const [hike] = await db.select({ slug: hikes.slug }).from(hikes).where(eq(hikes.slug, slug));
    if (!hike) throw new Error(`There's no hike at "${slug}".`);
    await db.insert(hikeGuests).values({ slug, userId: user.id }).onConflictDoNothing();
  };

  if (cmd === "add") {
    await db.insert(editors).values({ userId: user.id, role }).onConflictDoUpdate({ target: editors.userId, set: { role } });
    if (values.hike) await give(values.hike);
    console.log(`✓ ${email} can now use the editor as ${role}${values.hike ? `, with "${values.hike}"` : role === "guest" ? " (no hikes yet: they can create one, or give them one with `pnpm editors grant`)" : ""}`);
  } else if (cmd === "grant" || cmd === "revoke") {
    if (!values.hike) throw new Error(usage);
    const [person] = await db.select({ role: editors.role }).from(editors).where(eq(editors.userId, user.id));
    if (!person) throw new Error(`${email} isn't on the editors list. Add them first: pnpm editors add ${email} --role guest`);
    if (cmd === "grant") {
      await give(values.hike);
      console.log(`✓ ${email} can edit "${values.hike}"${person.role === "guest" ? "" : ` (as ${person.role} they could already edit every hike)`}`);
    } else {
      await db.delete(hikeGuests).where(and(eq(hikeGuests.userId, user.id), eq(hikeGuests.slug, values.hike)));
      console.log(`✓ ${email} no longer has "${values.hike}"`);
    }
  } else {
    await db.delete(editors).where(eq(editors.userId, user.id));
    console.log(`✓ ${email} removed from the editors list (their account still exists)`);
  }
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
