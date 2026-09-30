import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Wordmark } from "@/components/ui/Logo";
import { editorEnabled, listHikeFolders } from "@/lib/editor-fs";

export const metadata: Metadata = { title: "Editor", robots: { index: false } };

export default async function EditorIndex() {
  if (!editorEnabled) notFound();
  const slugs = await listHikeFolders();
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <Wordmark />
      <h1 className="mt-8 font-display text-h2 font-bold text-forest">Edit a hike</h1>
      <p className="mt-2 text-bark">Local only. Saves write straight to content/hikes. New hikes come from <code>pnpm ingest</code>.</p>
      <ul className="mt-6 divide-y divide-line rounded-[10px] border border-line bg-card">
        {slugs.map((slug) => (
          <li key={slug}>
            <Link href={`/editor/${slug}`} className="flex justify-between px-4 py-3 text-graphite hover:bg-highlight">
              <span className="font-mono">{slug}</span>
              <span className="text-bark">Edit →</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
