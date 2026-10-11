"use client";

import Link from "next/link";
import { useSession } from "@/components/ui/useSession";

/** "Edit this guide", for someone signed in who may edit it. Visitors never see it, or the request behind it. */
export function EditGuideLink({ slug, className }: { slug: string; className?: string }) {
  const session = useSession(slug);
  if (!session?.canEdit) return null;
  return (
    <Link href={`/editor/${slug}`} className={className}>
      ✎ Edit this guide
    </Link>
  );
}
