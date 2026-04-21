import { getPool } from "@/lib/db/pool";

export type ActiveUptimeCheck = {
  uptime_check_id: string;
  website_id: string;
  url: string;
};

export type InsertUptimeLogInput = {
  websiteId: string;
  uptimeCheckId: string;
  checkedAt: Date;
  httpStatus: number | null;
  responseTimeMs: number | null;
  isUp: boolean;
  errorMessage: string | null;
};

export async function getActiveUptimeChecks(): Promise<ActiveUptimeCheck[]> {
  const pool = getPool();
  const result = await pool.query<ActiveUptimeCheck>(
    `SELECT
       uc.id AS uptime_check_id,
       uc.website_id,
       coalesce(
         nullif(trim(uc.url), ''),
         nullif(trim(w.monitoring_url), ''),
         'https://' || w.primary_domain
       ) AS url
     FROM uptime_checks uc
     JOIN websites w ON w.id = uc.website_id
     WHERE uc.is_enabled = true
       AND w.is_active = true
       AND w.deleted_at IS NULL`,
  );

  return result.rows.filter((row) => {
    try {
      const parsed = new URL(row.url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  });
}

export async function insertUptimeLog(input: InsertUptimeLogInput): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO uptime_logs (
      website_id,
      uptime_check_id,
      checked_at,
      http_status,
      response_time_ms,
      is_up,
      error_message
    ) VALUES ($1,$2,$3::timestamptz,$4,$5,$6,$7)`,
    [
      input.websiteId,
      input.uptimeCheckId,
      input.checkedAt.toISOString(),
      input.httpStatus,
      input.responseTimeMs,
      input.isUp,
      input.errorMessage,
    ],
  );
}
