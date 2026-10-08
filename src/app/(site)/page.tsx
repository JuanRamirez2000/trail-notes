import type { Metadata } from "next";
import { Gallery } from "@/components/gallery/Gallery";
import { getHikeSummaries } from "@/lib/content";

// Same caching as the guide pages: refreshed on save, hourly as a safety net.
export const revalidate = 3600;

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  return <Gallery hikes={await getHikeSummaries()} />;
}
