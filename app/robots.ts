import type { MetadataRoute } from "next";
import { getSitemapBaseUrl } from "@/lib/app-url";

export default function robots(): MetadataRoute.Robots {
  const base = getSitemapBaseUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api"],
    },
    sitemap: `${base.replace(/\/$/, "")}/sitemap.xml`,
  };
}
