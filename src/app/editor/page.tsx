import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EditorAccount } from "@/components/editor/EditorAccount";
import { Wordmark } from "@/components/ui/Logo";
import { can } from "@/lib/auth/can";
import { authMode, getEditor } from "@/lib/auth/server";
import { getStore } from "@/lib/store/server";

export const metadata: Metadata = { title: "Editor", robots: { index: false } };
// Who may see this is decided per request, never baked into a build.
export const dynamic = "force-dynamic";

export default async function EditorIndex() {
  const editor = await getEditor();
  if (!can(editor, "list")) notFound();
  const store = await getStore();
  const hikes = await store.list();

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <Wordmark />
        <EditorAccount name={editor.name} canSignOut={authMode() === "supabase"} />
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-h2 font-bold text-forest">Edit a hike</h1>
        {can(editor, "create") && (
          <Link href="/editor/new" className="rounded-lg border-2 border-forest bg-highlight px-3.5 py-1 text-graphite">
            ＋ New hike
          </Link>
        )}
      </div>
      <p className="mt-2 text-bark">
        {store.kind === "supabase"
          ? "Saves go to the database and are public within seconds once a guide is published."
          : "Saves write to content/hikes on this machine."}{" "}
        Photos are added with <code>pnpm ingest</code>.
      </p>
      <ul className="mt-6 divide-y divide-line rounded-[10px] border border-line bg-card">
        {hikes.map((h) => (
          <li key={h.slug}>
            <Link href={`/editor/${h.slug}`} className="flex items-center justify-between gap-3 px-4 py-3 text-graphite hover:bg-highlight">
              <span className="min-w-0">
                <span className="block truncate">{h.details?.title ?? h.slug}</span>
                <span className="block font-mono text-xs text-bark">
                  {h.slug}
                  {h.details === null && " · needs fixing: its details don't validate"}
                </span>
              </span>
              <span className="flex flex-none items-center gap-3 text-sm text-bark">
                <span className="rounded-full border border-line-strong px-2.5">{h.status === "published" ? "Published" : "Draft"}</span>
                Edit →
              </span>
            </Link>
          </li>
        ))}
        {hikes.length === 0 && <li className="px-4 py-3 text-bark">No hikes yet.</li>}
      </ul>
    </main>
  );
}
