/**
 * Who may use the editor on the live site.
 *
 *   pnpm editors list
 *   pnpm editors add <email> [--role owner|editor]   the person must already have an account (see below)
 *   pnpm editors remove <email>
 *
 * Being signed in is not enough to edit: the site looks the user up in the `editors` table.
 * This script only manages that list. It never creates accounts: with sign-ups closed, add the
 * person under Authentication → Users in the Supabase dashboard first (same email as their Google
 * account); their first Google sign-in then attaches to that user.
 * Needs DATABASE_URL (.env.local). Accounts are looked up read-only in Supabase's auth.users.
 */
import { parseArgs } from "node:util";
import { asc, eq, sql } from "drizzle-orm";
import { authUsers } from "drizzle-orm/supabase";
import { editors } from "../src/db/schema";
import { scriptDatabase } from "./lib/stores";

try {
  process.loadEnvFile(".env.local");
} catch {
  // optional
}

const { values, positionals } = parseArgs({ allowPositionals: true, options: { role: { type: "string", default: "editor" } } });
const [cmd, email] = positionals;

async function main() {
  const db = scriptDatabase("pnpm editors");

  if (cmd === "list") {
    const rows = await db.select({ role: editors.role, email: authUsers.email, userId: editors.userId }).from(editors).leftJoin(authUsers, eq(authUsers.id, editors.userId)).orderBy(asc(editors.createdAt));
    if (!rows.length) console.log("No editors yet. Add one with: pnpm editors add <email> --role owner");
    for (const row of rows) console.log(`  ${row.role.padEnd(6)} ${row.email ?? row.userId}`);
    return;
  }

  if (!email || !["add", "remove"].includes(cmd)) throw new Error("Usage: pnpm editors <list | add <email> [--role owner|editor] | remove <email>>");
  const role = values.role;
  if (role !== "owner" && role !== "editor") throw new Error('--role must be "owner" or "editor"');
  const [user] = await db.select({ id: authUsers.id }).from(authUsers).where(sql`lower(${authUsers.email}) = ${email.toLowerCase()}`);
  if (!user) throw new Error(`No account for ${email}. Add the user in the Supabase dashboard (Authentication → Users) first.`);

  if (cmd === "add") {
    await db.insert(editors).values({ userId: user.id, role }).onConflictDoUpdate({ target: editors.userId, set: { role } });
    console.log(`✓ ${email} can now use the editor as ${role}`);
  } else {
    await db.delete(editors).where(eq(editors.userId, user.id));
    console.log(`✓ ${email} removed from the editors list (their account still exists)`);
  }
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
