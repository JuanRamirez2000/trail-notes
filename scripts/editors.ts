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
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local).
 */
import { parseArgs } from "node:util";
import { serviceClient } from "../src/lib/store/supabase";

try {
  process.loadEnvFile(".env.local");
} catch {
  // optional
}

const { values, positionals } = parseArgs({ allowPositionals: true, options: { role: { type: "string", default: "editor" } } });
const [cmd, email] = positionals;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example)");
  const supabase = await serviceClient(url, key);

  const users = async () => {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(error.message);
    return data.users;
  };
  const find = async (e: string) => (await users()).find((u) => u.email?.toLowerCase() === e.toLowerCase());

  if (cmd === "list") {
    const { data, error } = await supabase.from("editors").select("user_id, role, created_at").order("created_at");
    if (error) throw new Error(error.message);
    const all = await users();
    if (!data.length) console.log("No editors yet. Add one with: pnpm editors add <email> --role owner");
    for (const row of data) console.log(`  ${row.role.padEnd(6)} ${all.find((u) => u.id === row.user_id)?.email ?? row.user_id}`);
    return;
  }

  if (!email || !["add", "remove"].includes(cmd)) throw new Error("Usage: pnpm editors <list | add <email> [--role owner|editor] | remove <email>>");
  if (!["owner", "editor"].includes(values.role)) throw new Error('--role must be "owner" or "editor"');
  const user = await find(email);
  if (!user) throw new Error(`No account for ${email}. Add the user in the Supabase dashboard (Authentication → Users) first.`);

  if (cmd === "add") {
    const { error } = await supabase.from("editors").upsert({ user_id: user.id, role: values.role });
    if (error) throw new Error(error.message);
    console.log(`✓ ${email} can now use the editor as ${values.role}`);
  } else {
    const { error } = await supabase.from("editors").delete().eq("user_id", user.id);
    if (error) throw new Error(error.message);
    console.log(`✓ ${email} removed from the editors list (their account still exists)`);
  }
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
