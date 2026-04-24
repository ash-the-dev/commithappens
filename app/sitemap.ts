import type { MetadataRoute } from "next";
import { getSitemapBaseUrl } from "@/lib/app-url";

/**
 * Public, indexable routes (no authenticated `/dashboard` paths).
 * Served at `/sitemap.xml` by Next.js.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSitemapBaseUrl();
  const now = new Date();

  const b = base.replace(/\/$/, "");
  /** Indexable marketing URLs only (auth/billing are noindex; still crawlable via links). */
  const entries: {
    path: string;
    changeFrequency: NonNullable<MetadataRoute.Sitemap[0]["changeFrequency"]>;
    priority: number;
  }[] = [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/pricing", changeFrequency: "monthly", priority: 0.9 },
  ];

  return entries.map((e) => ({
    url: e.path === "/" ? `${b}/` : `${b}${e.path}`,
    lastModified: now,
    changeFrequency: e.changeFrequency,
    priority: e.priority,
  }));
}
