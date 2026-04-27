import { getPool } from "@/lib/db/pool";

export type ScanType = "seo" | "uptime" | "analytics" | "reputation";
export type ScanStatus = "complete" | "failed";

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
  status: ScanStatus;
  completed_at: string;
  result_summary: ScanSummaryByType[T];
  source: string | null;
};

let ensuredScansTable = false;

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
      completed_at timestamptz NOT NULL,
      result_summary jsonb NOT NULL,
      source text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT scans_type_chk CHECK (scan_type IN ('seo', 'uptime', 'analytics', 'reputation')),
      CONSTRAINT scans_status_chk CHECK (status IN ('complete', 'failed')),
      CONSTRAINT scans_complete_payload_chk CHECK (
        status <> 'complete'
        OR (completed_at IS NOT NULL AND result_summary IS NOT NULL AND jsonb_typeof(result_summary) = 'object')
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
  await pool.query(`CREATE INDEX IF NOT EXISTS scans_site_type_completed_idx ON scans (site_id, scan_type, completed_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS scans_status_completed_idx ON scans (status, completed_at DESC)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS scans_site_type_completed_uidx ON scans (site_id, scan_type, completed_at)`);
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

export async function recordCompletedScan<T extends ScanType>(input: {
  siteId: string;
  scanType: T;
  completedAt?: string | Date;
  resultSummary: ScanSummaryByType[T];
  source?: string;
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
    `INSERT INTO scans (site_id, scan_type, status, completed_at, result_summary, source, created_at, updated_at)
     VALUES ($1::uuid, $2, 'complete', $3::timestamptz, $4::jsonb, $5, now(), now())
     ON CONFLICT (site_id, scan_type, completed_at)
     DO UPDATE SET
       status = 'complete',
       result_summary = EXCLUDED.result_summary,
       source = EXCLUDED.source,
       updated_at = now()`,
    [input.siteId, input.scanType, completedAt, JSON.stringify(input.resultSummary), input.source ?? null],
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
    status: ScanStatus;
    completed_at: string;
    result_summary: unknown;
    source: string | null;
  }>(
    `SELECT DISTINCT ON (scan_type)
       id::text,
       site_id::text,
       scan_type,
       status,
       completed_at::text,
       result_summary,
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
      completed_at: row.completed_at,
      result_summary: row.result_summary as never,
      source: row.source,
    } as never;
  }
  return scans;
}
