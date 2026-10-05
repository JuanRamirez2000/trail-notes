import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createStore } from "../store";
import { serviceClient, supabaseBackend } from "../supabase";
import { describeStoreContract } from "./contract";

/**
 * Runs the contract against the real Supabase project. There is no local Supabase on this machine
 * (no Docker), so it uses clearly namespaced draft rows (`zz-contract-*`) and removes them after.
 * Opt-in only, and never in CI:
 *
 *   SUPABASE_CONTRACT_TESTS=1 pnpm test supabase
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // no env file: the suite is skipped below
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const enabled = process.env.SUPABASE_CONTRACT_TESTS === "1" && !!url && !!serviceKey;

if (enabled) {
  describeStoreContract("Supabase", async () => createStore(supabaseBackend(await serviceClient(url!, serviceKey!))), "zz-contract-supabase");

  describe("Supabase lockdown", () => {
    it("records every save in the history table, with who made it", async () => {
      const client = await serviceClient(url!, serviceKey!);
      const store = createStore(supabaseBackend(client));
      const slug = "zz-contract-history";
      await store.remove(slug);
      const sp = (await createStore((await import("../local")).localBackend()).read("strawberry-peak"))!;
      const mdx = sp.mdx.replace("slug: strawberry-peak", `slug: ${slug}`).replace(/^date:/m, "draft: true\ndate:");
      const created = await store.create(slug, { mdx, waypoints: sp.waypoints }, { editor: null });
      await store.save(slug, { mdx: mdx.replace("7.3 miles", "7.4 miles"), waypoints: sp.waypoints }, {
        editor: { id: "local", name: "Tester", email: "tester@example.test", role: "owner" },
        baseVersion: created.ok ? created.version : "",
      });
      const { data } = await client.from("hike_revisions").select("version, saved_by, saved_by_label").eq("slug", slug).order("version");
      expect(data).toEqual([
        { version: 1, saved_by: null, saved_by_label: "script" },
        { version: 2, saved_by: null, saved_by_label: "tester@example.test" },
      ]);
      await store.remove(slug);
    });

    it.runIf(!!publicKey)("gives the public key nothing: no rows, no writes, no functions", async () => {
      const anon = createClient(url!, publicKey!, { auth: { persistSession: false } });
      for (const table of ["hikes", "hike_revisions", "editors"]) {
        const read = await anon.from(table).select("*").limit(1);
        expect(read.data ?? []).toEqual([]); // row-level security: nothing visible (or an outright permission error)
      }
      const write = await anon.from("hikes").insert({ slug: "zz-anon", mdx: "x", waypoints: {}, details: {}, status: "published" });
      expect(write.error).not.toBeNull();
      const rpc = await anon.rpc("create_hike", { p_slug: "zz-anon", p_mdx: "x", p_waypoints: {}, p_track: null, p_details: {}, p_status: "published", p_editor: null, p_editor_label: "anon" });
      expect(rpc.error).not.toBeNull();
      const service = await serviceClient(url!, serviceKey!);
      const { data } = await service.from("hikes").select("slug").eq("slug", "zz-anon");
      expect(data).toEqual([]);
    });
  });
} else {
  describe.skip("ContentStore contract: Supabase (set SUPABASE_CONTRACT_TESTS=1 to run)", () => {
    it("skipped", () => {});
  });
}
