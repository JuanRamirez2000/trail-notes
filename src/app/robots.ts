import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** The guides are for everyone; the editor, sign-in and the API are not for crawlers. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/editor", "/sign-in", "/auth/", "/api/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
