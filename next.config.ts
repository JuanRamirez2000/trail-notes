import type { NextConfig } from "next";

// Guides are read through the content store at request time (src/lib/content.ts), so there is no
// content build step and nothing to watch: under `pnpm dev` an edited file shows on the next request.
// `next dev` evaluates this file in a child process whose argv doesn't include "dev", so go by
// NODE_ENV (Next sets it before loading the config).
const isDev = process.env.NODE_ENV === "development";

// NEXT_PUBLIC_* values are inlined into client JS. A secret Mapbox token (sk.*) would leak to
// every visitor, and Mapbox GL rejects it anyway, so refuse to start rather than ship it.
if (process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.startsWith("sk.")) {
  throw new Error(
    "NEXT_PUBLIC_MAPBOX_TOKEN is a secret token (sk.*). Use a public token (pk.*) from https://account.mapbox.com.",
  );
}

// Photos live in Supabase; /public/photos is a gitignored dev-only copy, so a production build
// on the local backend would ship broken images.
if (!isDev && process.env.NEXT_PUBLIC_PHOTO_STORAGE !== "supabase") {
  throw new Error(
    "Production builds need NEXT_PUBLIC_PHOTO_STORAGE=supabase (and NEXT_PUBLIC_SUPABASE_URL). The local photo backend is dev-only.",
  );
}

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // While guides are read from files (CONTENT_STORE unset), pages are re-rendered on the server
  // after deploy, so content/hikes must ship inside the server bundle, not just exist at build.
  outputFileTracingIncludes: { "/**": ["./content/hikes/**/*"] },
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

export default nextConfig;
