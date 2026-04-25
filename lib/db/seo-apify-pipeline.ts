import { getPool } from "@/lib/db/pool";
import type { NormalizedApifySeoResults } from "@/lib/seo/normalizeApifyResults";
import { buildResponseCodeReportFromParsed } from "@/lib/seo/response-codes";
import { parseResponseCodesFromNormalizedRows } from "@/lib/seo/response-codes";
import type { NormalizedCrawlRow } from "@/lib/seo/apify/normalize";
import { buildSeoCrawlRunSummary, classifySeoCrawlPage } from "@/lib/seo/crawl/crawl-classification";

const ensured = new Set<string>();

async function ensureSeoPipelineTables() {
  if (ensured.has("seo-apify-pipeline")) return;
  const pool = getPool();
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS seo_crawl_runs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id text NOT NULL,
      source text NOT NULL DEFAULT 'apify',
      actor_id text,
      actor_run_id text,
      dataset_id text,
      external_source_id text,
      status text NOT NULL DEFAULT 'pending',
      pages_crawled integer DEFAULT 0,
      healthy_count integer NOT NULL DEFAULT 0,
      notice_count integer NOT NULL DEFAULT 0,
      warning_count integer NOT NULL DEFAULT 0,
      critical_count integer NOT NULL DEFAULT 0,
      health_score integer NOT NULL DEFAULT 100,
      user_id uuid NULL,
      domain text,
      provider text DEFAULT 'apify',
      provider_run_id text,
      provider_dataset_id text,
      started_at timestamptz DEFAULT now(),
      finished_at timestamptz,
      error_message text,
      raw_summary jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    ALTER TABLE seo_crawl_runs
      ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'apify',
      ADD COLUMN IF NOT EXISTS actor_id text,
      ADD COLUMN IF NOT EXISTS actor_run_id text,
      ADD COLUMN IF NOT EXISTS dataset_id text,
      ADD COLUMN IF NOT EXISTS external_source_id text,
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS pages_crawled integer DEFAULT 0,
      ADD COLUMN IF NOT EXISTS healthy_count integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS notice_count integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS warning_count integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS critical_count integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS health_score integer NOT NULL DEFAULT 100,
      ADD COLUMN IF NOT EXISTS user_id uuid NULL,
      ADD COLUMN IF NOT EXISTS domain text,
      ADD COLUMN IF NOT EXISTS provider text DEFAULT 'apify',
      ADD COLUMN IF NOT EXISTS provider_run_id text,
      ADD COLUMN IF NOT EXISTS provider_dataset_id text,
      ADD COLUMN IF NOT EXISTS started_at timestamptz DEFAULT now(),
      ADD COLUMN IF NOT EXISTS finished_at timestamptz,
      ADD COLUMN IF NOT EXISTS error_message text,
      ADD COLUMN IF NOT EXISTS raw_summary jsonb,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS seo_crawl_pages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      crawl_run_id uuid NOT NULL REFERENCES seo_crawl_runs (id) ON DELETE CASCADE,
      site_id text NOT NULL,
      url text NOT NULL,
      status integer,
      title text,
      meta_description text,
      h1 text,
      links jsonb,
      issue_type text,
      issue_severity text,
      crawl_notes text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS seo_page_reports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      crawl_run_id uuid REFERENCES seo_crawl_runs(id) ON DELETE CASCADE,
      site_id text NULL,
      url text NOT NULL,
      status_code int NULL,
      title text NULL,
      title_length int NULL,
      meta_description text NULL,
      meta_description_length int NULL,
      h1s jsonb NULL,
      h1_count int NULL,
      canonical_url text NULL,
      is_indexable boolean NULL,
      internal_links jsonb NULL,
      external_links jsonb NULL,
      broken_links jsonb NULL,
      issues jsonb NULL,
      warnings jsonb NULL,
      opportunities jsonb NULL,
      score int NULL,
      raw jsonb NULL,
      created_at timestamptz DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS seo_issues (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      crawl_run_id uuid REFERENCES seo_crawl_runs(id) ON DELETE CASCADE,
      site_id text NULL,
      url text NULL,
      type text NOT NULL,
      severity text NOT NULL,
      title text NOT NULL,
      description text NOT NULL,
      recommendation text NOT NULL,
      plain_meaning text,
      why_it_matters text,
      recommended_fix text,
      priority_label text,
      effort text,
      impact_area text NOT NULL,
      owner_hint text,
      created_at timestamptz DEFAULT now()
    )
  `);
  await pool.query(`
    ALTER TABLE seo_issues
      ADD COLUMN IF NOT EXISTS plain_meaning text,
      ADD COLUMN IF NOT EXISTS why_it_matters text,
      ADD COLUMN IF NOT EXISTS recommended_fix text,
      ADD COLUMN IF NOT EXISTS priority_label text,
      ADD COLUMN IF NOT EXISTS effort text,
      ADD COLUMN IF NOT EXISTS owner_hint text
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS seo_site_summaries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      crawl_run_id uuid REFERENCES seo_crawl_runs(id) ON DELETE CASCADE,
      site_id text NULL,
      domain text NOT NULL,
      score int NULL,
      total_pages int DEFAULT 0,
      successful_pages int DEFAULT 0,
      error_pages int DEFAULT 0,
      critical_issues int DEFAULT 0,
      high_issues int DEFAULT 0,
      medium_issues int DEFAULT 0,
      low_issues int DEFAULT 0,
      summary jsonb NULL,
      created_at timestamptz DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_seo_crawl_runs_provider_run ON seo_crawl_runs(provider_run_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_seo_crawl_runs_actor_run ON seo_crawl_runs(actor_run_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_seo_crawl_runs_site_id_created_at ON seo_crawl_runs(site_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_seo_page_reports_crawl_run ON seo_page_reports(crawl_run_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_seo_issues_crawl_run ON seo_issues(crawl_run_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_seo_site_summaries_site_created ON seo_site_summaries(site_id, created_at DESC)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS response_code_reports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id text NOT NULL,
      report_json jsonb NOT NULL,
      source text,
      crawl_run_id uuid REFERENCES seo_crawl_runs(id) ON DELETE SET NULL,
      source_dataset_id text,
      processing_status text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    ALTER TABLE response_code_reports
      ADD COLUMN IF NOT EXISTS source text,
      ADD COLUMN IF NOT EXISTS crawl_run_id uuid REFERENCES seo_crawl_runs(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS source_dataset_id text,
      ADD COLUMN IF NOT EXISTS processing_status text
  `);
  ensured.add("seo-apify-pipeline");
}

export async function createPendingSeoCrawlRun(input: {
  userId: string;
  siteId: string;
  domain: string;
  actorId: string;
}): Promise<{ id: string }> {
  await ensureSeoPipelineTables();
  const pool = getPool();
  const result = await pool.query<{ id: string }>(
    `INSERT INTO seo_crawl_runs (
       user_id, site_id, domain, source, provider, actor_id, status, started_at, created_at, updated_at
     ) VALUES ($1::uuid, $2::text, $3, 'apify', 'apify', $4, 'pending', now(), now(), now())
     RETURNING id`,
    [input.userId, input.siteId, input.domain, input.actorId],
  );
  return { id: result.rows[0].id };
}

export async function attachProviderRunToSeoCrawlRun(input: {
  crawlRunId: string;
  providerRunId: string;
  providerDatasetId?: string | null;
}) {
  await ensureSeoPipelineTables();
  const pool = getPool();
  await pool.query(
    `UPDATE seo_crawl_runs
     SET status = 'running',
         actor_run_id = $2,
         provider_run_id = $2,
         external_source_id = $2,
         dataset_id = coalesce($3, dataset_id),
         provider_dataset_id = coalesce($3, provider_dataset_id),
         updated_at = now()
     WHERE id = $1::uuid`,
    [input.crawlRunId, input.providerRunId, input.providerDatasetId ?? null],
  );
}

export async function markSeoCrawlRunFailedByProviderRunId(input: {
  providerRunId: string;
  errorMessage: string;
}) {
  await ensureSeoPipelineTables();
  const pool = getPool();
  await pool.query(
    `UPDATE seo_crawl_runs
     SET status = 'failed',
         error_message = $2,
         finished_at = now(),
         updated_at = now()
     WHERE provider_run_id = $1 OR actor_run_id = $1`,
    [input.providerRunId, input.errorMessage.slice(0, 1000)],
  );
}

export async function markSeoCrawlRunFailedById(input: {
  crawlRunId: string;
  errorMessage: string;
}) {
  await ensureSeoPipelineTables();
  const pool = getPool();
  await pool.query(
    `UPDATE seo_crawl_runs
     SET status = 'failed',
         error_message = $2,
         finished_at = now(),
         updated_at = now()
     WHERE id = $1::uuid`,
    [input.crawlRunId, input.errorMessage.slice(0, 1000)],
  );
}

export async function getSeoCrawlRunByProviderRunId(providerRunId: string): Promise<{
  id: string;
  site_id: string;
  domain: string | null;
  status: string;
} | null> {
  await ensureSeoPipelineTables();
  const pool = getPool();
  const result = await pool.query<{
    id: string;
    site_id: string;
    domain: string | null;
    status: string;
  }>(
    `SELECT id, site_id, domain, status
     FROM seo_crawl_runs
     WHERE provider_run_id = $1 OR actor_run_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [providerRunId],
  );
  return result.rows[0] ?? null;
}

export async function getSeoCrawlRunStatusById(crawlRunId: string): Promise<{
  id: string;
  site_id: string;
  user_id: string | null;
  status: string;
  pages_crawled: number;
  error_message: string | null;
  finished_at: string | null;
  updated_at: string;
} | null> {
  await ensureSeoPipelineTables();
  const pool = getPool();
  const result = await pool.query<{
    id: string;
    site_id: string;
    user_id: string | null;
    status: string;
    pages_crawled: string | null;
    error_message: string | null;
    finished_at: string | null;
    updated_at: string;
  }>(
    `SELECT
       id,
       site_id,
       user_id::text,
       status,
       coalesce(pages_crawled, 0)::text AS pages_crawled,
       error_message,
       finished_at::text,
       updated_at::text
     FROM seo_crawl_runs
     WHERE id = $1::uuid
     LIMIT 1`,
    [crawlRunId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    site_id: row.site_id,
    user_id: row.user_id,
    status: row.status,
    pages_crawled: Number(row.pages_crawled ?? 0),
    error_message: row.error_message,
    finished_at: row.finished_at,
    updated_at: row.updated_at,
  };
}

function toExistingRows(results: NormalizedApifySeoResults): Array<{
  row: NormalizedCrawlRow;
  cls: ReturnType<typeof classifySeoCrawlPage>;
}> {
  return results.pages.map((page) => {
    const row: NormalizedCrawlRow = {
      url: page.url,
      status: page.statusCode,
      title: page.title,
      metaDescription: page.metaDescription,
      h1: page.h1s[0] ?? null,
      links: page.internalLinks,
    };
    return {
      row,
      cls: classifySeoCrawlPage({
        status: page.statusCode,
        title: page.title,
        meta_description: page.metaDescription,
        h1: page.h1s[0] ?? null,
      }),
    };
  });
}

export async function persistApifySeoResults(input: {
  crawlRunId: string;
  siteId: string;
  domain: string;
  providerDatasetId: string;
  results: NormalizedApifySeoResults;
}) {
  await ensureSeoPipelineTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM seo_crawl_pages WHERE crawl_run_id = $1::uuid`, [input.crawlRunId]);
    await client.query(`DELETE FROM seo_page_reports WHERE crawl_run_id = $1::uuid`, [input.crawlRunId]);
    await client.query(`DELETE FROM seo_issues WHERE crawl_run_id = $1::uuid`, [input.crawlRunId]);
    await client.query(`DELETE FROM seo_site_summaries WHERE crawl_run_id = $1::uuid`, [input.crawlRunId]);

    for (const page of input.results.pages) {
      await client.query(
        `INSERT INTO seo_page_reports (
          crawl_run_id, site_id, url, status_code, title, title_length, meta_description,
          meta_description_length, h1s, h1_count, canonical_url, is_indexable, internal_links,
          external_links, broken_links, issues, warnings, opportunities, score, raw
        ) VALUES (
          $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13::jsonb,
          $14::jsonb, $15::jsonb, $16::jsonb, $17::jsonb, $18::jsonb, $19, $20::jsonb
        )`,
        [
          input.crawlRunId,
          input.siteId,
          page.url,
          page.statusCode,
          page.title,
          page.titleLength,
          page.metaDescription,
          page.metaDescriptionLength,
          JSON.stringify(page.h1s),
          page.h1Count,
          page.canonicalUrl,
          page.isIndexable,
          JSON.stringify(page.internalLinks),
          JSON.stringify(page.externalLinks),
          JSON.stringify(page.brokenLinks),
          JSON.stringify(page.issues),
          JSON.stringify(page.warnings),
          JSON.stringify(page.opportunities),
          page.score,
          JSON.stringify(page.raw ?? {}),
        ],
      );
    }

    for (const issue of input.results.issues) {
      await client.query(
        `INSERT INTO seo_issues (
          crawl_run_id, site_id, url, type, severity, title, description, recommendation,
          plain_meaning, why_it_matters, recommended_fix, priority_label, effort, impact_area, owner_hint
        ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          input.crawlRunId,
          input.siteId,
          issue.url,
          issue.type,
          issue.severity,
          issue.title,
          issue.description,
          issue.recommendation,
          issue.plainMeaning,
          issue.whyItMatters,
          issue.recommendedFix,
          issue.priorityLabel,
          issue.effort,
          issue.impactArea,
          issue.ownerHint,
        ],
      );
    }

    const existingRows = toExistingRows(input.results);
    for (const { row, cls } of existingRows) {
      await client.query(
        `INSERT INTO seo_crawl_pages (
          crawl_run_id, site_id, url, status, title, meta_description, h1, links,
          issue_type, issue_severity, crawl_notes
        ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)`,
        [
          input.crawlRunId,
          input.siteId,
          row.url,
          row.status,
          row.title,
          row.metaDescription,
          row.h1,
          JSON.stringify(row.links),
          cls.issue_type,
          cls.issue_severity,
          cls.crawl_notes,
        ],
      );
    }

    const summaryCounts = buildSeoCrawlRunSummary(existingRows.map((item) => item.cls));
    const critical = input.results.issues.filter((issue) => issue.severity === "critical").length;
    const high = input.results.issues.filter((issue) => issue.severity === "high").length;
    const medium = input.results.issues.filter((issue) => issue.severity === "medium").length;
    const low = input.results.issues.filter((issue) => issue.severity === "low").length;
    await client.query(
      `INSERT INTO seo_site_summaries (
        crawl_run_id, site_id, domain, score, total_pages, successful_pages, error_pages,
        critical_issues, high_issues, medium_issues, low_issues, summary
      ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)`,
      [
        input.crawlRunId,
        input.siteId,
        input.domain,
        input.results.summary.score,
        input.results.summary.totalPages,
        input.results.summary.successfulPages,
        input.results.summary.errorPages,
        critical,
        high,
        medium,
        low,
        JSON.stringify(input.results.summary),
      ],
    );

    const parsed = parseResponseCodesFromNormalizedRows(existingRows.map((item) => item.row), `apify:${input.providerDatasetId}`);
    const report = buildResponseCodeReportFromParsed(parsed);
    await client.query(
      `INSERT INTO response_code_reports (
        site_id, report_json, source, crawl_run_id, source_dataset_id, processing_status
      ) VALUES ($1, $2::jsonb, 'apify', $3::uuid, $4, 'completed')`,
      [input.siteId, JSON.stringify(report), input.crawlRunId, input.providerDatasetId],
    );

    await client.query(
      `UPDATE seo_crawl_runs
       SET status = 'succeeded',
           dataset_id = $2,
           provider_dataset_id = $2,
           pages_crawled = $3,
           healthy_count = $4,
           notice_count = $5,
           warning_count = $6,
           critical_count = $7,
           health_score = $8,
           finished_at = now(),
           raw_summary = $9::jsonb,
           updated_at = now()
       WHERE id = $1::uuid`,
      [
        input.crawlRunId,
        input.providerDatasetId,
        input.results.summary.scannedPages,
        summaryCounts.healthy_count,
        summaryCounts.notice_count,
        summaryCounts.warning_count,
        summaryCounts.critical_count,
        input.results.summary.score,
        JSON.stringify(input.results.summary),
      ],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
