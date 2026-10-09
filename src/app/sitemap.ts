import type { MetadataRoute } from "next";
import { getHikeSummaries } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

// Same caching as the pages it lists: hourly, so a newly published hike appears without a deploy.
export const revalidate = 3600;

/** The landing page, the gallery and every published guide (drafts are never listed). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const hikes = await getHikeSummaries();
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/hikes`, changeFrequency: "weekly", priority: 0.9 },
    ...hikes.map((h) => ({ url: `${SITE_URL}/hikes/${h.slug}`, lastModified: h.date, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
