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
  description?: string | null;
  recommendation?: string | null;
  plainMeaning?: string | null;
  whyItMatters?: string | null;
  recommendedFix?: string | null;
  priorityLabel?: string | null;
  effort?: string | null;
  impactArea?: string | null;
  ownerHint?: string | null;
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

function normalizeHost(value: string): string | null {
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function urlBelongsToDomain(url: string | null | undefined, primaryDomain: string | null | undefined): boolean {
  if (!url || !primaryDomain) return false;
  const urlHost = normalizeHost(url);
  const siteHost = normalizeHost(primaryDomain);
  return Boolean(urlHost && siteHost && urlHost === siteHost);
}

async function matchingRunIdsForDomain(runIds: string[], primaryDomain: string | null): Promise<Set<string>> {
  if (runIds.length === 0 || !primaryDomain) return new Set();
  const pool = getPool();
  const result = await pool.query<{ crawl_run_id: string; url: string }>(
    `SELECT crawl_run_id::text, url
     FROM seo_crawl_pages
     WHERE crawl_run_id = ANY($1::uuid[])`,
    [runIds],
  );
  const matching = new Set<string>();
  for (const row of result.rows) {
    if (urlBelongsToDomain(row.url, primaryDomain)) {
      matching.add(row.crawl_run_id);
    }
  }
  return matching;
}

export async function getLatestSeoCrawlRun(siteId: string): Promise<SeoCrawlRunRow | null> {
  const pool = getPool();
  const site = await pool.query<{ primary_domain: string; owner_user_id: string }>(
    `SELECT primary_domain, owner_user_id::text FROM websites WHERE id = $1::uuid LIMIT 1`,
    [siteId],
  );
  const primaryDomain = site.rows[0]?.primary_domain ?? null;
  const ownerUserId = site.rows[0]?.owner_user_id ?? null;
  const primaryHost = primaryDomain ? normalizeHost(primaryDomain) : null;
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
     WHERE (
         site_id = $1::text
         OR ($2::uuid IS NOT NULL AND user_id = $2::uuid)
         OR ($3::text IS NOT NULL AND lower(coalesce(domain, '')) LIKE '%' || $3::text || '%')
       )
       AND status IN ('succeeded', 'completed')
       AND coalesce(pages_crawled, 0) > 0
     ORDER BY created_at DESC
     LIMIT 20`,
    [siteId, ownerUserId, primaryHost],
  );
  const matchingRunIds = await matchingRunIdsForDomain(r.rows.map((row) => row.id), primaryDomain);
  const row = r.rows.find((candidate) => matchingRunIds.has(candidate.id));
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

export async function countSeoCrawlRunsForSiteSince(
  siteId: string,
  since: Date,
): Promise<number> {
  const pool = getPool();
  const site = await pool.query<{ primary_domain: string; owner_user_id: string }>(
    `SELECT primary_domain, owner_user_id::text FROM websites WHERE id = $1::uuid LIMIT 1`,
    [siteId],
  );
  const primaryDomain = site.rows[0]?.primary_domain ?? null;
  const ownerUserId = site.rows[0]?.owner_user_id ?? null;
  const primaryHost = primaryDomain ? normalizeHost(primaryDomain) : null;
  const result = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count
     FROM seo_crawl_runs
     WHERE (
         site_id = $1::text
         OR ($2::uuid IS NOT NULL AND user_id = $2::uuid)
         OR ($3::text IS NOT NULL AND lower(coalesce(domain, '')) LIKE '%' || $3::text || '%')
       )
       AND created_at >= $4::timestamptz`,
    [siteId, ownerUserId, primaryHost, since.toISOString()],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export type SeoCrawlRunTrendPoint = {
  created_at: string;
  health_score: number;
  issues_total: number;
  pages_crawled: number;
};

/**
 * Newest `limit` runs, returned oldest-first for time-series charts.
 */
export async function getSeoCrawlRunHistory(siteId: string, limit = 16): Promise<SeoCrawlRunTrendPoint[]> {
  const safe = Math.max(1, Math.min(40, limit));
  const pool = getPool();
  const site = await pool.query<{ primary_domain: string; owner_user_id: string }>(
    `SELECT primary_domain, owner_user_id::text FROM websites WHERE id = $1::uuid LIMIT 1`,
    [siteId],
  );
  const primaryDomain = site.rows[0]?.primary_domain ?? null;
  const ownerUserId = site.rows[0]?.owner_user_id ?? null;
  const primaryHost = primaryDomain ? normalizeHost(primaryDomain) : null;
  const r = await pool.query<{
    id: string;
    created_at: string;
    health_score: string | null;
    notice_count: string | null;
    warning_count: string | null;
    critical_count: string | null;
    pages_crawled: string | null;
  }>(
    `SELECT *
     FROM (
       SELECT
         id::text,
         created_at::text,
         coalesce(health_score, 100)::text AS health_score,
         coalesce(notice_count, 0)::text AS notice_count,
         coalesce(warning_count, 0)::text AS warning_count,
         coalesce(critical_count, 0)::text AS critical_count,
         coalesce(pages_crawled, 0)::text AS pages_crawled
       FROM seo_crawl_runs
       WHERE (
           site_id = $1::text
           OR ($2::uuid IS NOT NULL AND user_id = $2::uuid)
           OR ($3::text IS NOT NULL AND lower(coalesce(domain, '')) LIKE '%' || $3::text || '%')
         )
         AND status IN ('succeeded', 'completed')
         AND coalesce(pages_crawled, 0) > 0
       ORDER BY created_at DESC
       LIMIT 40
     ) sub
     ORDER BY created_at ASC`,
    [siteId, ownerUserId, primaryHost],
  );
  const matchingRunIds = await matchingRunIdsForDomain(r.rows.map((row) => row.id), primaryDomain);
  return r.rows.filter((row) => matchingRunIds.has(row.id)).slice(-safe).map((row) => {
    const n = Number(row.notice_count ?? 0);
    const w = Number(row.warning_count ?? 0);
    const c = Number(row.critical_count ?? 0);
    return {
      created_at: row.created_at,
      health_score: Number(row.health_score ?? 100),
      issues_total: n + w + c,
      pages_crawled: Number(row.pages_crawled ?? 0),
    };
  });
}

export type SeoCrawlOnPageBreakdown = {
  runCreatedAt: string | null;
  pagesCrawled: number;
  titleMissing: number;
  titlePresent: number;
  metaMissing: number;
  metaPresent: number;
  h1Missing: number;
  h1Present: number;
  /** Pages where we stored a links array. */
  internalLinkPagesWithData: number;
  /** Average out-link count when `links` is a JSON array. */
  internalLinksAvg: number | null;
  indexable2xx: number;
  notIndexable: number;
  brokenPages: number;
  duplicateOrThinFlags: number;
  byIssueType: Record<string, number>;
};

/**
 * On-page and indexability rollups for the latest stored crawl, if any.
 */
export async function getSeoCrawlOnPageBreakdown(siteId: string): Promise<SeoCrawlOnPageBreakdown | null> {
  const pool = getPool();
  const site = await pool.query<{ primary_domain: string; owner_user_id: string }>(
    `SELECT primary_domain, owner_user_id::text FROM websites WHERE id = $1::uuid LIMIT 1`,
    [siteId],
  );
  const primaryDomain = site.rows[0]?.primary_domain ?? null;
  const ownerUserId = site.rows[0]?.owner_user_id ?? null;
  const primaryHost = primaryDomain ? normalizeHost(primaryDomain) : null;
  const run = await pool.query<{ id: string; created_at: string; pages_crawled: string | null }>(
    `SELECT id, created_at::text, coalesce(pages_crawled, 0)::text AS pages_crawled
     FROM seo_crawl_runs
     WHERE (
         site_id = $1::text
         OR ($2::uuid IS NOT NULL AND user_id = $2::uuid)
         OR ($3::text IS NOT NULL AND lower(coalesce(domain, '')) LIKE '%' || $3::text || '%')
       )
       AND status IN ('succeeded', 'completed')
       AND coalesce(pages_crawled, 0) > 0
     ORDER BY created_at DESC
     LIMIT 20`,
    [siteId, ownerUserId, primaryHost],
  );
  const matchingRunIds = await matchingRunIdsForDomain(run.rows.map((row) => row.id), primaryDomain);
  const runRow = run.rows.find((candidate) => matchingRunIds.has(candidate.id));
  if (!runRow) return null;

  const byIssue = await pool.query<{ issue_type: string; n: string }>(
    `SELECT coalesce(issue_type, 'unknown') AS issue_type, count(*)::text AS n
     FROM seo_crawl_pages
     WHERE crawl_run_id = $1::uuid
     GROUP BY 1`,
    [runRow.id],
  );
  const byIssueType: Record<string, number> = {};
  for (const row of byIssue.rows) {
    byIssueType[row.issue_type] = Number(row.n);
  }

  const fac = await pool.query<{
    title_missing: string;
    title_present: string;
    meta_missing: string;
    meta_present: string;
    h1_missing: string;
    h1_present: string;
    with_links: string;
    avg_links: string | null;
    ok2xx: string;
    not_ok: string;
    broken: string;
    dup_thin: string;
  }>(
    `SELECT
       count(*) filter (where coalesce(nullif(trim(title), ''), '') = '')::text AS title_missing,
       count(*) filter (where coalesce(nullif(trim(title), ''), '') <> '')::text AS title_present,
       count(*) filter (where coalesce(nullif(trim(meta_description), ''), '') = '')::text AS meta_missing,
       count(*) filter (where coalesce(nullif(trim(meta_description), ''), '') <> '')::text AS meta_present,
       count(*) filter (where coalesce(nullif(trim(h1), ''), '') = '')::text AS h1_missing,
       count(*) filter (where coalesce(nullif(trim(h1), ''), '') <> '')::text AS h1_present,
       count(*) filter (where links is not null AND jsonb_typeof(links) = 'array' AND jsonb_array_length(links) > 0)::text AS with_links,
       avg(
         CASE
           WHEN jsonb_typeof(links) = 'array' AND jsonb_array_length(links) > 0
             THEN jsonb_array_length(links)::float
           ELSE NULL
         END
       )::text AS avg_links,
       count(*) filter (where status >= 200 AND status < 300)::text AS ok2xx,
       count(*) filter (where status IS NULL OR status < 200 OR status >= 300)::text AS not_ok,
       count(*) filter (where coalesce(issue_type, '') = 'broken_page' OR (status IS NOT NULL AND status >= 400 AND status < 500))::text AS broken,
       count(*) filter (
         where coalesce(issue_type, '') in ('missing_title', 'missing_h1', 'missing_meta_description')
       )::text AS dup_thin
     FROM seo_crawl_pages
     WHERE crawl_run_id = $1::uuid`,
    [runRow.id],
  );
  const f = fac.rows[0];
  if (!f) {
    return {
      runCreatedAt: runRow.created_at,
      pagesCrawled: Number(runRow.pages_crawled || 0),
      titleMissing: 0,
      titlePresent: 0,
      metaMissing: 0,
      metaPresent: 0,
      h1Missing: 0,
      h1Present: 0,
      internalLinkPagesWithData: 0,
      internalLinksAvg: null,
      indexable2xx: 0,
      notIndexable: 0,
      brokenPages: 0,
      duplicateOrThinFlags: 0,
      byIssueType,
    };
  }

  return {
    runCreatedAt: runRow.created_at,
    pagesCrawled: Number(runRow.pages_crawled || 0),
    titleMissing: Number(f.title_missing),
    titlePresent: Number(f.title_present),
    metaMissing: Number(f.meta_missing),
    metaPresent: Number(f.meta_present),
    h1Missing: Number(f.h1_missing),
    h1Present: Number(f.h1_present),
    internalLinkPagesWithData: Number(f.with_links),
    internalLinksAvg: f.avg_links != null ? Number(f.avg_links) : null,
    indexable2xx: Number(f.ok2xx),
    notIndexable: Number(f.not_ok),
    brokenPages: Number(f.broken),
    duplicateOrThinFlags: Number(f.dup_thin),
    byIssueType,
  };
}

/**
 * Most important non-healthy pages from the latest crawl (by severity, then URL).
 */
export async function getTopCrawlIssues(siteId: string, limit = 3): Promise<SeoCrawlTopIssue[]> {
  const safeLimit = Math.max(1, Math.min(10, limit));
  const pool = getPool();
  const site = await pool.query<{ primary_domain: string }>(
    `SELECT primary_domain FROM websites WHERE id = $1::uuid LIMIT 1`,
    [siteId],
  );
  const primaryDomain = site.rows[0]?.primary_domain ?? null;
  const latestRun = await getLatestSeoCrawlRun(siteId);
  if (!latestRun) return [];
  try {
    const enriched = await pool.query<{
      url: string | null;
      type: string;
      severity: string;
      title: string;
      description: string;
      recommendation: string;
      plain_meaning: string | null;
      why_it_matters: string | null;
      recommended_fix: string | null;
      priority_label: string | null;
      effort: string | null;
      impact_area: string | null;
      owner_hint: string | null;
    }>(
      `SELECT
         i.url,
         i.type,
         i.severity,
         i.title,
         i.description,
         i.recommendation,
         i.plain_meaning,
         i.why_it_matters,
         i.recommended_fix,
         i.priority_label,
         i.effort,
         i.impact_area,
         i.owner_hint
       FROM seo_issues i
       WHERE i.crawl_run_id = $1::uuid
       ORDER BY
         CASE i.severity
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
           ELSE 5
         END,
         i.url NULLS LAST,
         i.type
       LIMIT $2`,
      [latestRun.id, safeLimit],
    );
    if (enriched.rows.length > 0) {
      return enriched.rows
      .filter((row) => urlBelongsToDomain(row.url, primaryDomain))
      .map((row) => ({
        url: row.url ?? "",
        status: null,
        title: row.title,
        h1: null,
        meta_description: null,
        internal_links_count: null,
        issue_type: row.type,
        issue_severity: row.severity,
        crawl_notes: null,
        description: row.description,
        recommendation: row.recommendation,
        plainMeaning: row.plain_meaning,
        whyItMatters: row.why_it_matters,
        recommendedFix: row.recommended_fix,
        priorityLabel: row.priority_label,
        effort: row.effort,
        impactArea: row.impact_area,
        ownerHint: row.owner_hint,
      }));
    }
  } catch {
    // Older deployments may not have seo_issues yet; fall back to seo_crawl_pages.
  }

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
     WHERE p.crawl_run_id = $1::uuid
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
    [latestRun.id, safeLimit],
  );
  return r.rows
  .filter((row) => urlBelongsToDomain(row.url, primaryDomain))
  .map((row) => ({
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
