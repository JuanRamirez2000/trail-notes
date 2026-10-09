/**
 * Where the site lives, for absolute links (sitemap, robots, social cards).
 *   NEXT_PUBLIC_SITE_URL                 set this once the site has its own domain
 *   VERCEL_PROJECT_PRODUCTION_URL        set by Vercel on every deploy (the production domain)
 *   http://localhost:3100                `pnpm dev`
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3100")
).replace(/\/+$/, "");

export const SITE_NAME = "Trailnotes";
export const SITE_DESCRIPTION = "Photo-by-photo hiking guides: every turn, viewpoint, water source and bail-out on the map.";
export const REPO_URL = "https://github.com/JuanRamirez2000/trail-notes";

/** The pages that list hikes (the landing page's latest guides, the gallery): refreshed whenever a hike appears, changes or goes. */
/** A guide's social card image (its cover, as a JPEG), and the size it's made at. */
export const ogImagePath = (slug: string) => `/hikes/${slug}/og.jpg`;
export const OG_SIZE = { width: 1200, height: 630 };

export const LIST_PATHS = ["/", "/hikes"] as const;
