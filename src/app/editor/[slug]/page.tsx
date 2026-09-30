import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Editor } from "@/components/editor/Editor";
import { editorEnabled, readHikeFiles } from "@/lib/editor-fs";

export const metadata: Metadata = { title: "Editor", robots: { index: false } };

export default async function EditHike({ params }: PageProps<"/editor/[slug]">) {
  if (!editorEnabled) notFound();
  const { slug } = await params;
  const files = await readHikeFiles(slug).catch(() => null);
  if (!files) notFound();
  return <Editor slug={slug} initialMdx={files.mdx} initialWaypoints={files.waypoints} />;
}
