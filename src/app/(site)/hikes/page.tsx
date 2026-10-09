import type { Metadata } from "next";
import { Gallery } from "@/components/gallery/Gallery";
import { getHikeSummaries } from "@/lib/content";

// Same caching as the guide pages: refreshed on save, hourly as a safety net.
export const revalidate = 3600;

export const metadata: Metadata = { title: "Hikes", description: "Every Trailnotes guide on one map. Filter by difficulty, distance and climb.", alternates: { canonical: "/hikes" } };

export default async function HikesPage() {
  return <Gallery hikes={await getHikeSummaries()} />;
}
