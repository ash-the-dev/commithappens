import type { MetadataRoute } from "next";
import { getPublicOrigin } from "@/lib/public-origin";

export default function robots(): MetadataRoute.Robots {
  const base = getPublicOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api"],
    },
    sitemap: `${base.replace(/\/$/, "")}/sitemap.xml`,
  };
}
