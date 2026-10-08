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

// A mistyped switch must stop the build, not quietly fall back to the other backend.
for (const [name, allowed] of [
  ["NEXT_PUBLIC_PHOTO_STORAGE", ["local", "supabase"]],
  ["CONTENT_STORE", ["local", "supabase"]],
  ["EDITOR_AUTH", ["supabase", "off"]],
] as const) {
  const value = process.env[name];
  if (value && !(allowed as readonly string[]).includes(value)) throw new Error(`${name} must be ${allowed.map((a) => `"${a}"`).join(" or ")} (or unset), not "${value}".`);
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

// Sent with every response. No Content-Security-Policy yet: the editor's preview evaluates
// compiled MDX and Mapbox needs blob: workers, so one has to be introduced report-only first.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  headers: async () => [{ source: "/:path*", headers: securityHeaders }],
  // When guides are read from files (CONTENT_STORE unset or "local"), pages are re-rendered on the
  // server after deploy, so content/hikes must ship inside the server bundle, not just exist at build.
  outputFileTracingIncludes: { "/**": ["./content/hikes/**/*"] },
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

export default nextConfig;
