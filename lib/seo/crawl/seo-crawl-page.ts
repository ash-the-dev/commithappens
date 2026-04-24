import type { NormalizedCrawlRow } from "@/lib/seo/apify/normalize";

/**
 * Insert shape for `seo_crawl_pages` (and helpers). `site_id` is always `websites.id::text`.
 * HTTP status is column `status` (integer), not `status_code`.
 */
export type SeoCrawlPageRow = {
  crawl_run_id: string;
  site_id: string;
  url: string;
  status: number | null;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
  /** Stored as jsonb; typically string[] of URLs */
  links: string[];
  issue_type?: string;
  issue_severity?: string;
  crawl_notes?: string;
};

/**
 * Map normalized crawl data into a `seo_crawl_pages` row. Does not set `id` or `created_at` (DB defaults).
 */
export function buildSeoCrawlPageRow(
  input: {
    crawlRunId: string;
    websiteIdText: string;
    row: NormalizedCrawlRow;
  },
): SeoCrawlPageRow {
  return {
    crawl_run_id: input.crawlRunId,
    site_id: input.websiteIdText,
    url: input.row.url,
    status: input.row.status,
    title: input.row.title,
    meta_description: input.row.metaDescription,
    h1: input.row.h1,
    links: input.row.links,
  };
}

/**
 * Key order matches common dashboard expectations (for tests / documentation parity).
 */
export const SEO_CRAWL_PAGE_FIELDS = [
  "url",
  "status",
  "title",
  "meta_description",
  "h1",
  "links",
] as const;
