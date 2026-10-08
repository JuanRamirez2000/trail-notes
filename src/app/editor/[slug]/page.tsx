import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Editor } from "@/components/editor/Editor";
import { can } from "@/lib/auth/can";
import { authMode, getEditor } from "@/lib/auth/server";
import { SLUG } from "@/lib/schemas";
import { getStore } from "@/lib/store/server";

export const metadata: Metadata = { title: "Editor", robots: { index: false } };
// Who may see this is decided per request, never baked into a build.
export const dynamic = "force-dynamic";

export default async function EditHike({ params }: PageProps<"/editor/[slug]">) {
  const { slug } = await params;
  const editor = await getEditor();
  // Same answer for "not signed in", "not an editor" and "no such hike": a 404 that reveals nothing.
  if (!can(editor, "read", slug) || !SLUG.test(slug)) notFound();
  const hike = await (await getStore()).read(slug);
  if (!hike) notFound();
  return (
    <Editor
      slug={slug}
      initialMdx={hike.mdx}
      initialWaypoints={hike.waypoints}
      initialVersion={hike.version}
      track={hike.track}
      editorName={editor.name}
      canSignOut={authMode() === "supabase"}
    />
  );
}
