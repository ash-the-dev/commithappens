import { getPool } from "@/lib/db/pool";

export type ScanType = "seo" | "uptime" | "analytics" | "reputation";
export type ScanStatus = "running" | "complete" | "failed";

export type SeoScanSummary = {
  broken_pages: number;
  missing_meta: number;
  performance_issues: number;
};

export type UptimeScanSummary = {
  status: "online" | "offline";
  downtime_events: number;
};

export type AnalyticsScanSummary = {
  traffic_24h: number;
  trend: "up" | "down" | "flat";
};

export type ReputationScanSummary = {
  mentions: number;
  flagged_mentions: number;
};

export type ScanSummaryByType = {
  seo: SeoScanSummary;
  uptime: UptimeScanSummary;
  analytics: AnalyticsScanSummary;
  reputation: ReputationScanSummary;
};

export type CompletedScan<T extends ScanType = ScanType> = {
  id: string;
  site_id: string;
  scan_type: T;
  status: "complete";
  started_at: string;
  completed_at: string;
  result_summary: ScanSummaryByType[T];
  raw_result: unknown | null;
  source: string | null;
};

export type ScanLifecycleRecord<T extends ScanType = ScanType> = {
  id: string;
  site_id: string;
  scan_type: T;
  status: ScanStatus;
  started_at: string;
  completed_at: string | null;
  result_summary: ScanSummaryByType[T] | null;
  raw_result: unknown | null;
  error_message: string | null;
  source: string | null;
};

let ensuredScansTable = false;
const DEFAULT_STALE_SCAN_TIMEOUT_MINUTES = 30;

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function assertCompleteSummary<T extends ScanType>(scanType: T, summary: ScanSummaryByType[T]): void {
  if (!summary || typeof summary !== "object") {
    throw new Error("Completed scan requires result_summary.");
  }

  if (scanType === "seo") {
    const seo = summary as SeoScanSummary;
    if (!finiteNumber(seo.broken_pages) || !finiteNumber(seo.missing_meta) || !finiteNumber(seo.performance_issues)) {
      throw new Error("SEO scan summary must include broken_pages, missing_meta, and performance_issues.");
    }
    return;
  }

  if (scanType === "uptime") {
    const uptime = summary as UptimeScanSummary;
    if ((uptime.status !== "online" && uptime.status !== "offline") || !finiteNumber(uptime.downtime_events)) {
      throw new Error("Uptime scan summary must include status and downtime_events.");
    }
    return;
  }

  if (scanType === "analytics") {
    const analytics = summary as AnalyticsScanSummary;
    if (
      !finiteNumber(analytics.traffic_24h) ||
      (analytics.trend !== "up" && analytics.trend !== "down" && analytics.trend !== "flat")
    ) {
      throw new Error("Analytics scan summary must include traffic_24h and trend.");
    }
    return;
  }

  const reputation = summary as ReputationScanSummary;
  if (!finiteNumber(reputation.mentions) || !finiteNumber(reputation.flagged_mentions)) {
    throw new Error("Reputation scan summary must include mentions and flagged_mentions.");
  }
}

export async function ensureScansTable(): Promise<void> {
  if (ensuredScansTable) return;
  const pool = getPool();
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scans (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id uuid REFERENCES websites (id) ON DELETE CASCADE,
      scan_type text NOT NULL,
      status text NOT NULL DEFAULT 'complete',
      started_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz,
      result_summary jsonb,
      raw_result jsonb,
      error_message text,
      source text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT scans_type_chk CHECK (scan_type IN ('seo', 'uptime', 'analytics', 'reputation')),
      CONSTRAINT scans_status_chk CHECK (status IN ('running', 'complete', 'failed')),
      CONSTRAINT scans_complete_payload_chk CHECK (
        (
          status = 'running'
          AND started_at IS NOT NULL
          AND completed_at IS NULL
        )
        OR (
          status = 'complete'
          AND completed_at IS NOT NULL
          AND result_summary IS NOT NULL
          AND jsonb_typeof(result_summary) = 'object'
        )
        OR (
          status = 'failed'
          AND completed_at IS NOT NULL
          AND error_message IS NOT NULL
          AND trim(error_message) <> ''
        )
      ),
      CONSTRAINT scans_summary_shape_chk CHECK (
        status <> 'complete'
        OR (
          (
            scan_type = 'seo'
            AND result_summary ? 'broken_pages'
            AND result_summary ? 'missing_meta'
            AND result_summary ? 'performance_issues'
          )
          OR (
            scan_type = 'uptime'
            AND result_summary->>'status' IN ('online', 'offline')
            AND result_summary ? 'downtime_events'
          )
          OR (
            scan_type = 'analytics'
            AND result_summary ? 'traffic_24h'
            AND result_summary->>'trend' IN ('up', 'down', 'flat')
          )
          OR (
            scan_type = 'reputation'
            AND result_summary ? 'mentions'
            AND result_summary ? 'flagged_mentions'
          )
        )
      )
    )
  `);
  await pool.query(`
    ALTER TABLE scans
      ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS raw_result jsonb,
      ADD COLUMN IF NOT EXISTS error_message text,
      ALTER COLUMN completed_at DROP NOT NULL,
      ALTER COLUMN result_summary DROP NOT NULL
  `);
  await pool.query(`
    ALTER TABLE scans
      DROP CONSTRAINT IF EXISTS scans_status_chk,
      ADD CONSTRAINT scans_status_chk CHECK (status IN ('running', 'complete', 'failed'))
  `);
  await pool.query(`
    ALTER TABLE scans
      DROP CONSTRAINT IF EXISTS scans_complete_payload_chk,
      ADD CONSTRAINT scans_complete_payload_chk CHECK (
        (
          status = 'running'
          AND started_at IS NOT NULL
          AND completed_at IS NULL
        )
        OR (
          status = 'complete'
          AND completed_at IS NOT NULL
          AND result_summary IS NOT NULL
          AND jsonb_typeof(result_summary) = 'object'
        )
        OR (
          status = 'failed'
          AND completed_at IS NOT NULL
          AND error_message IS NOT NULL
          AND trim(error_message) <> ''
        )
      )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS scans_site_type_completed_idx ON scans (site_id, scan_type, completed_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS scans_status_completed_idx ON scans (status, completed_at DESC)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS scans_site_type_completed_uidx ON scans (site_id, scan_type, completed_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS scans_site_type_source_status_idx ON scans (site_id, scan_type, source, status, started_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS scans_seo_crawl_run_idx ON scans ((raw_result->>'crawlRunId')) WHERE scan_type = 'seo'`);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'scans_summary_shape_chk'
          AND conrelid = 'public.scans'::regclass
      ) THEN
        ALTER TABLE scans
          ADD CONSTRAINT scans_summary_shape_chk CHECK (
            status <> 'complete'
            OR (
              (
                scan_type = 'seo'
                AND result_summary ? 'broken_pages'
                AND result_summary ? 'missing_meta'
                AND result_summary ? 'performance_issues'
              )
              OR (
                scan_type = 'uptime'
                AND result_summary->>'status' IN ('online', 'offline')
                AND result_summary ? 'downtime_events'
              )
              OR (
                scan_type = 'analytics'
                AND result_summary ? 'traffic_24h'
                AND result_summary->>'trend' IN ('up', 'down', 'flat')
              )
              OR (
                scan_type = 'reputation'
                AND result_summary ? 'mentions'
                AND result_summary ? 'flagged_mentions'
              )
            )
          );
      END IF;
    END $$;
  `);
  ensuredScansTable = true;
}

export async function createRunningScan<T extends ScanType>(input: {
  siteId: string;
  scanType: T;
  startedAt?: string | Date;
  source?: string;
  rawResult?: unknown;
}): Promise<ScanLifecycleRecord<T>> {
  await ensureScansTable();
  const startedAt =
    input.startedAt instanceof Date ? input.startedAt.toISOString() : input.startedAt || new Date().toISOString();
  const pool = getPool();
  const result = await pool.query<{
    id: string;
    site_id: string;
    scan_type: T;
    status: ScanStatus;
    started_at: string;
    completed_at: string | null;
    result_summary: ScanSummaryByType[T] | null;
    raw_result: unknown | null;
    error_message: string | null;
    source: string | null;
  }>(
    `INSERT INTO scans (site_id, scan_type, status, started_at, raw_result, source, created_at, updated_at)
     VALUES ($1::uuid, $2, 'running', $3::timestamptz, $4::jsonb, $5, now(), now())
     RETURNING id::text, site_id::text, scan_type, status, started_at::text, completed_at::text, result_summary, raw_result, error_message, source`,
    [
      input.siteId,
      input.scanType,
      startedAt,
      input.rawResult == null ? null : JSON.stringify(input.rawResult),
      input.source ?? null,
    ],
  );
  return result.rows[0] as ScanLifecycleRecord<T>;
}

export async function completeScan<T extends ScanType>(input: {
  scanId: string;
  scanType: T;
  completedAt?: string | Date;
  resultSummary: ScanSummaryByType[T];
  rawResult?: unknown;
}): Promise<void> {
  const completedAt =
    input.completedAt instanceof Date ? input.completedAt.toISOString() : input.completedAt || new Date().toISOString();
  assertCompleteSummary(input.scanType, input.resultSummary);
  await ensureScansTable();
  const pool = getPool();
  await pool.query(
    `UPDATE scans
     SET status = 'complete',
         started_at = least(started_at, $2::timestamptz),
         completed_at = $2::timestamptz,
         result_summary = $3::jsonb,
         raw_result = coalesce($4::jsonb, raw_result),
         error_message = null,
         updated_at = now()
     WHERE id = $1::uuid`,
    [
      input.scanId,
      completedAt,
      JSON.stringify(input.resultSummary),
      input.rawResult == null ? null : JSON.stringify(input.rawResult),
    ],
  );
}

export async function failScan(input: {
  scanId: string;
  completedAt?: string | Date;
  errorMessage: string;
  rawResult?: unknown;
}): Promise<void> {
  const completedAt =
    input.completedAt instanceof Date ? input.completedAt.toISOString() : input.completedAt || new Date().toISOString();
  const message = input.errorMessage.trim() || "Scan failed. The robots tripped over something.";
  await ensureScansTable();
  const pool = getPool();
  await pool.query(
    `UPDATE scans
     SET status = 'failed',
         started_at = least(started_at, $2::timestamptz),
         completed_at = $2::timestamptz,
         error_message = $3,
         raw_result = coalesce($4::jsonb, raw_result),
         updated_at = now()
     WHERE id = $1::uuid`,
    [input.scanId, completedAt, message, input.rawResult == null ? null : JSON.stringify(input.rawResult)],
  );
}

export async function completeLatestRunningScan<T extends ScanType>(input: {
  siteId: string;
  scanType: T;
  source?: string;
  completedAt?: string | Date;
  resultSummary: ScanSummaryByType[T];
  rawResult?: unknown;
}): Promise<void> {
  await ensureScansTable();
  const pool = getPool();
  const latest = await pool.query<{ id: string }>(
    `SELECT id::text
     FROM scans
     WHERE site_id = $1::uuid
       AND scan_type = $2
       AND status = 'running'
       AND ($3::text IS NULL OR source = $3)
     ORDER BY started_at DESC
     LIMIT 1`,
    [input.siteId, input.scanType, input.source ?? null],
  );
  const row = latest.rows[0];
  if (row) {
    await completeScan({ ...input, scanId: row.id });
    return;
  }
  await recordCompletedScan(input);
}

export async function completeSeoScanForCrawlRun(input: {
  siteId: string;
  crawlRunId: string;
  completedAt?: string | Date;
  resultSummary: SeoScanSummary;
  rawResult?: unknown;
}): Promise<void> {
  const source = `seo-crawl:${input.crawlRunId}`;
  await ensureScansTable();
  const pool = getPool();
  const latest = await pool.query<{ id: string }>(
    `SELECT id::text
     FROM scans
     WHERE scan_type = 'seo'
       AND status = 'running'
       AND (
         source = $1
         OR raw_result->>'crawlRunId' = $2
       )
     ORDER BY started_at DESC
     LIMIT 1`,
    [source, input.crawlRunId],
  );
  const row = latest.rows[0];
  if (row) {
    await completeScan({
      scanId: row.id,
      scanType: "seo",
      completedAt: input.completedAt,
      resultSummary: input.resultSummary,
      rawResult: input.rawResult,
    });
    return;
  }
  await recordCompletedScan({
    siteId: input.siteId,
    scanType: "seo",
    completedAt: input.completedAt,
    resultSummary: input.resultSummary,
    source,
    rawResult: input.rawResult,
  });
}

export async function failLatestRunningScan(input: {
  siteId: string;
  scanType: ScanType;
  source?: string;
  completedAt?: string | Date;
  errorMessage: string;
  rawResult?: unknown;
}): Promise<void> {
  await ensureScansTable();
  const pool = getPool();
  const latest = await pool.query<{ id: string }>(
    `SELECT id::text
     FROM scans
     WHERE site_id = $1::uuid
       AND scan_type = $2
       AND status = 'running'
       AND ($3::text IS NULL OR source = $3)
     ORDER BY started_at DESC
     LIMIT 1`,
    [input.siteId, input.scanType, input.source ?? null],
  );
  const row = latest.rows[0];
  if (row) {
    await failScan({ ...input, scanId: row.id });
    return;
  }
  const running = await createRunningScan({
    siteId: input.siteId,
    scanType: input.scanType,
    source: input.source,
    rawResult: input.rawResult,
  });
  await failScan({ ...input, scanId: running.id });
}

export async function failSeoScanForCrawlRun(input: {
  siteId?: string;
  crawlRunId: string;
  completedAt?: string | Date;
  errorMessage: string;
  rawResult?: unknown;
}): Promise<void> {
  const source = `seo-crawl:${input.crawlRunId}`;
  await ensureScansTable();
  const pool = getPool();
  const latest = await pool.query<{ id: string; site_id: string }>(
    `SELECT id::text, site_id::text
     FROM scans
     WHERE scan_type = 'seo'
       AND status = 'running'
       AND (
         source = $1
         OR raw_result->>'crawlRunId' = $2
       )
     ORDER BY started_at DESC
     LIMIT 1`,
    [source, input.crawlRunId],
  );
  const row = latest.rows[0];
  if (row) {
    await failScan({
      scanId: row.id,
      completedAt: input.completedAt,
      errorMessage: input.errorMessage,
      rawResult: input.rawResult,
    });
    return;
  }
  if (!input.siteId) return;
  const running = await createRunningScan({
    siteId: input.siteId,
    scanType: "seo",
    source,
    rawResult: input.rawResult,
  });
  await failScan({
    scanId: running.id,
    completedAt: input.completedAt,
    errorMessage: input.errorMessage,
    rawResult: input.rawResult,
  });
}

export async function markStaleRunningScansFailed(input: {
  siteId?: string;
  scanType?: ScanType;
  olderThanMinutes?: number;
  errorMessage?: string;
} = {}): Promise<ScanLifecycleRecord[]> {
  await ensureScansTable();
  const minutes = Math.max(1, input.olderThanMinutes ?? DEFAULT_STALE_SCAN_TIMEOUT_MINUTES);
  const message = input.errorMessage?.trim() || "SEO crawl timed out before import completed.";
  const pool = getPool();
  const result = await pool.query<{
    id: string;
    site_id: string;
    scan_type: ScanType;
    status: ScanStatus;
    started_at: string;
    completed_at: string | null;
    result_summary: unknown | null;
    raw_result: unknown | null;
    error_message: string | null;
    source: string | null;
  }>(
    `UPDATE scans
     SET status = 'failed',
         completed_at = now(),
         error_message = $4,
         updated_at = now()
     WHERE status = 'running'
       AND completed_at IS NULL
       AND started_at < now() - ($1::text || ' minutes')::interval
       AND ($2::uuid IS NULL OR site_id = $2::uuid)
       AND ($3::text IS NULL OR scan_type = $3)
     RETURNING id::text, site_id::text, scan_type, status, started_at::text, completed_at::text, result_summary, raw_result, error_message, source`,
    [String(minutes), input.siteId ?? null, input.scanType ?? null, message],
  );
  return result.rows.map((row) => ({
    id: row.id,
    site_id: row.site_id,
    scan_type: row.scan_type,
    status: row.status,
    started_at: row.started_at,
    completed_at: row.completed_at,
    result_summary: row.result_summary as never,
    raw_result: row.raw_result,
    error_message: row.error_message,
    source: row.source,
  }));
}

export async function recordCompletedScan<T extends ScanType>(input: {
  siteId: string;
  scanType: T;
  completedAt?: string | Date;
  resultSummary: ScanSummaryByType[T];
  source?: string;
  rawResult?: unknown;
}): Promise<void> {
  await ensureScansTable();
  const completedAt =
    input.completedAt instanceof Date
      ? input.completedAt.toISOString()
      : input.completedAt || new Date().toISOString();

  if (!completedAt || !input.resultSummary || typeof input.resultSummary !== "object") {
    console.error("[scans] refused incomplete completed scan", {
      siteId: input.siteId,
      scanType: input.scanType,
      hasCompletedAt: Boolean(completedAt),
      hasSummary: Boolean(input.resultSummary),
    });
    throw new Error("Completed scan requires completed_at and result_summary.");
  }
  assertCompleteSummary(input.scanType, input.resultSummary);

  const pool = getPool();
  await pool.query(
    `INSERT INTO scans (site_id, scan_type, status, started_at, completed_at, result_summary, raw_result, source, created_at, updated_at)
     VALUES ($1::uuid, $2, 'complete', $3::timestamptz, $3::timestamptz, $4::jsonb, $5::jsonb, $6, now(), now())
     ON CONFLICT (site_id, scan_type, completed_at)
     DO UPDATE SET
       status = 'complete',
       result_summary = EXCLUDED.result_summary,
       raw_result = EXCLUDED.raw_result,
       source = EXCLUDED.source,
       updated_at = now()`,
    [
      input.siteId,
      input.scanType,
      completedAt,
      JSON.stringify(input.resultSummary),
      input.rawResult == null ? null : JSON.stringify(input.rawResult),
      input.source ?? null,
    ],
  );
  console.info("[scans] recorded completed scan", {
    siteId: input.siteId,
    scanType: input.scanType,
    completedAt,
  });
}

export async function getLatestCompletedScans(siteId: string): Promise<Partial<{
  [K in ScanType]: CompletedScan<K>;
}>> {
  await ensureScansTable();
  const pool = getPool();
  const result = await pool.query<{
    id: string;
    site_id: string;
    scan_type: ScanType;
    status: "complete";
    started_at: string;
    completed_at: string;
    result_summary: unknown;
    raw_result: unknown | null;
    source: string | null;
  }>(
    `SELECT DISTINCT ON (scan_type)
       id::text,
       site_id::text,
       scan_type,
       status,
       started_at::text,
       completed_at::text,
       result_summary,
       raw_result,
       source
     FROM scans
     WHERE site_id = $1::uuid
       AND status = 'complete'
       AND completed_at IS NOT NULL
       AND result_summary IS NOT NULL
     ORDER BY scan_type, completed_at DESC`,
    [siteId],
  );

  const scans: Partial<{ [K in ScanType]: CompletedScan<K> }> = {};
  for (const row of result.rows) {
    scans[row.scan_type] = {
      id: row.id,
      site_id: row.site_id,
      scan_type: row.scan_type,
      status: row.status,
      started_at: row.started_at,
      completed_at: row.completed_at,
      result_summary: row.result_summary as never,
      raw_result: row.raw_result,
      source: row.source,
    } as never;
  }
  return scans;
}

export async function getLatestScansByType(siteId: string): Promise<Partial<{
  [K in ScanType]: ScanLifecycleRecord<K>;
}>> {
  await markStaleRunningScansFailed({ siteId, scanType: "seo" });
  await ensureScansTable();
  const pool = getPool();
  const result = await pool.query<{
    id: string;
    site_id: string;
    scan_type: ScanType;
    status: ScanStatus;
    started_at: string;
    completed_at: string | null;
    result_summary: unknown | null;
    raw_result: unknown | null;
    error_message: string | null;
    source: string | null;
  }>(
    `SELECT DISTINCT ON (scan_type)
       id::text,
       site_id::text,
       scan_type,
       status,
       started_at::text,
       completed_at::text,
       result_summary,
       raw_result,
       error_message,
       source
     FROM scans
     WHERE site_id = $1::uuid
     ORDER BY scan_type, coalesce(completed_at, started_at) DESC, created_at DESC`,
    [siteId],
  );

  const scans: Partial<{ [K in ScanType]: ScanLifecycleRecord<K> }> = {};
  for (const row of result.rows) {
    scans[row.scan_type] = {
      id: row.id,
      site_id: row.site_id,
      scan_type: row.scan_type,
      status: row.status,
      started_at: row.started_at,
      completed_at: row.completed_at,
      result_summary: row.result_summary as never,
      raw_result: row.raw_result,
      error_message: row.error_message,
      source: row.source,
    } as never;
  }
  return scans;
}
