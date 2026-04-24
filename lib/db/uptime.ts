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

const FREE_TIER_MIN_PROBE_GAP_MIN = 15;

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
     LEFT JOIN user_subscriptions s ON s.user_id = w.owner_user_id
     LEFT JOIN LATERAL (
       SELECT max(ul.checked_at) AS last_at
       FROM uptime_logs ul
       WHERE ul.uptime_check_id = uc.id
     ) last_log ON true
     WHERE uc.is_enabled = true
       AND w.is_active = true
       AND w.deleted_at IS NULL
       AND (
         (COALESCE(s.status, '') IN ('trialing', 'active', 'past_due') AND s.plan_key IS NOT NULL)
         OR last_log.last_at IS NULL
         OR last_log.last_at < now() - ($1::int * interval '1 minute')
       )`,
    [FREE_TIER_MIN_PROBE_GAP_MIN],
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
