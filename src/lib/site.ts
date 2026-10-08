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
