import { getPool } from "@/lib/db/pool";
import type { SeoCrawlPageClassification, SeoCrawlRunSummary } from "@/lib/seo/crawl/crawl-classification";

export type SeoCrawlRunRow = {
  id: string;
  site_id: string;
  created_at: string;
  health_score: number;
  healthy_count: number;
  notice_count: number;
  warning_count: number;
  critical_count: number;
  pages_crawled: number;
};

export type SeoCrawlTopIssue = {
  url: string;
  status: number | null;
  title: string | null;
  h1: string | null;
  meta_description: string | null;
  /** Count of out-links the crawl stored for this page, when the payload was an array. */
  internal_links_count: number | null;
  issue_type: string;
  issue_severity: string;
  crawl_notes: string | null;
};

function countLinks(links: unknown): number | null {
  if (links == null) return null;
  if (Array.isArray(links)) return links.length;
  if (typeof links === "object" && "length" in (links as object)) {
    const n = (links as { length: unknown }).length;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function getLatestSeoCrawlRun(siteId: string): Promise<SeoCrawlRunRow | null> {
  const pool = getPool();
  const r = await pool.query<{
    id: string;
    site_id: string;
    created_at: string;
    health_score: string | null;
    healthy_count: string | null;
    notice_count: string | null;
    warning_count: string | null;
    critical_count: string | null;
    pages_crawled: string | null;
  }>(
    `SELECT
       id,
       site_id,
       created_at::text,
       coalesce(health_score, 100)::text AS health_score,
       coalesce(healthy_count, 0)::text AS healthy_count,
       coalesce(notice_count, 0)::text AS notice_count,
       coalesce(warning_count, 0)::text AS warning_count,
       coalesce(critical_count, 0)::text AS critical_count,
       coalesce(pages_crawled, 0)::text AS pages_crawled
     FROM seo_crawl_runs
     WHERE site_id = $1::text
     ORDER BY created_at DESC
     LIMIT 1`,
    [siteId],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    site_id: row.site_id,
    created_at: row.created_at,
    health_score: Number(row.health_score ?? 100),
    healthy_count: Number(row.healthy_count ?? 0),
    notice_count: Number(row.notice_count ?? 0),
    warning_count: Number(row.warning_count ?? 0),
    critical_count: Number(row.critical_count ?? 0),
    pages_crawled: Number(row.pages_crawled ?? 0),
  };
}

/**
 * Most important non-healthy pages from the latest crawl (by severity, then URL).
 */
export async function getTopCrawlIssues(siteId: string, limit = 3): Promise<SeoCrawlTopIssue[]> {
  const safeLimit = Math.max(1, Math.min(10, limit));
  const pool = getPool();
  const r = await pool.query<{
    url: string;
    status: string | null;
    title: string | null;
    h1: string | null;
    meta_description: string | null;
    links: unknown;
    issue_type: string | null;
    issue_severity: string | null;
    crawl_notes: string | null;
  }>(
    `SELECT p.url, p.status::text, p.title, p.h1, p.meta_description, p.links, p.issue_type, p.issue_severity, p.crawl_notes
     FROM seo_crawl_pages p
     WHERE p.site_id = $1::text
       AND p.crawl_run_id = (
         SELECT id FROM seo_crawl_runs
         WHERE site_id = $1::text
         ORDER BY created_at DESC
         LIMIT 1
       )
       AND coalesce(p.issue_severity, 'healthy') <> 'healthy'
     ORDER BY
       CASE p.issue_severity
         WHEN 'critical' THEN 1
         WHEN 'warning' THEN 2
         WHEN 'notice' THEN 3
         ELSE 4
       END,
       p.url
     LIMIT $2`,
    [siteId, safeLimit],
  );
  return r.rows.map((row) => ({
    url: row.url,
    status: row.status != null && row.status !== "" ? Number(row.status) : null,
    title: row.title,
    h1: row.h1,
    meta_description: row.meta_description,
    internal_links_count: countLinks(row.links),
    issue_type: row.issue_type ?? "unknown",
    issue_severity: row.issue_severity ?? "unknown",
    crawl_notes: row.crawl_notes,
  }));
}

export type { SeoCrawlPageClassification, SeoCrawlRunSummary };
