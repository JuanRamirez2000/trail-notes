import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NewHikeForm } from "@/components/editor/NewHikeForm";
import { Wordmark } from "@/components/ui/Logo";
import { can } from "@/lib/auth/can";
import { getEditor } from "@/lib/auth/server";
import { getStore } from "@/lib/store/server";

export const metadata: Metadata = { title: "New hike", robots: { index: false } };
// Who may see this is decided per request, never baked into a build.
export const dynamic = "force-dynamic";

export default async function NewHike() {
  if (!can(await getEditor(), "create")) notFound();
  // So the form can say an address is taken before anything is sent.
  const taken = (await (await getStore()).list()).map((h) => h.slug);
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <Wordmark />
        <Link href="/editor" className="text-[15px] text-bark">
          ← Hikes
        </Link>
      </div>
      <h1 className="mt-8 font-display text-h2 font-bold text-forest">New hike</h1>
      <p className="mt-2 text-bark">This creates a draft: nothing is public until you publish it. Everything here can be changed later under Details.</p>
      <NewHikeForm taken={taken} />
    </main>
  );
}
