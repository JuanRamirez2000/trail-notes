import type { NextConfig } from "next";

// Velite watches content/ during `next dev`. Production builds run `velite build`
// explicitly first (see package.json) so the output always exists before Next compiles.
const isDev = process.argv.includes("dev");
if (isDev && !process.env.VELITE_STARTED) {
  process.env.VELITE_STARTED = "1";
  import("velite").then((m) => m.build({ watch: true, clean: false }));
}

// NEXT_PUBLIC_* values are inlined into client JS. A secret Mapbox token (sk.*) would leak to
// every visitor, and Mapbox GL rejects it anyway, so refuse to start rather than ship it.
if (process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.startsWith("sk.")) {
  throw new Error(
    "NEXT_PUBLIC_MAPBOX_TOKEN is a secret token (sk.*). Use a public token (pk.*) from https://account.mapbox.com.",
  );
}

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

export default nextConfig;
