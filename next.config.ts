import { existsSync, utimesSync, watch } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Velite watches content/ during `next dev`. Production builds run `velite build`
// explicitly first (see package.json) so the output always exists before Next compiles.
// `next dev` evaluates this file in a child process whose argv doesn't include "dev", so go by
// NODE_ENV (Next sets it before loading the config).
const isDev = process.env.NODE_ENV === "development";
if (isDev && !process.env.VELITE_STARTED) {
  process.env.VELITE_STARTED = "1";
  import("velite").then((m) => m.build({ watch: true, clean: false }));
  touchPostOnSidecarChange();
}

/**
 * Velite only recompiles the file that changed, but a post's stub sections are generated from its
 * sibling waypoints.json (and mileage from track.json). Touch index.mdx when either changes so
 * the post is recompiled against them.
 */
function touchPostOnSidecarChange() {
  const root = path.join(process.cwd(), "content/hikes");
  const pending = new Map<string, NodeJS.Timeout>();
  watch(root, { recursive: true }, (_event, file) => {
    const m = file && /^([a-z0-9-]+)[\\/](waypoints|track)\.json$/.exec(file);
    if (!m) return;
    const post = path.join(root, m[1], "index.mdx");
    clearTimeout(pending.get(post));
    pending.set(
      post,
      setTimeout(() => {
        pending.delete(post);
        const now = new Date();
        if (existsSync(post)) utimesSync(post, now, now);
      }, 100),
    );
  });
}

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
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

export default nextConfig;
