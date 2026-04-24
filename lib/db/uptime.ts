import { getPool } from "@/lib/db/pool";

const columnPresenceCache = new Map<string, boolean>();

async function hasPublicColumn(
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const cacheKey = `${tableName}.${columnName}`;
  const cached = columnPresenceCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const pool = getPool();
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) AS "exists"`,
    [tableName, columnName],
  );
  const exists = Boolean(result.rows[0]?.exists);
  columnPresenceCache.set(cacheKey, exists);
  return exists;
}

export type ActiveUptimeCheck = {
  uptime_check_id: string;
  website_id: string;
  url: string;
};

export type InsertUptimeLogInput = {
  websiteId: string;
  uptimeCheckId: string;
  userId?: string | null;
  checkedAt: Date;
  status: "up" | "down" | "degraded" | "error";
  statusCode: number | null;
  responseTimeMs: number | null;
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
  try {
    await pool.query(
      `INSERT INTO uptime_logs (
        user_id,
        website_id,
        uptime_check_id,
        status,
        status_code,
        checked_at,
        http_status,
        response_time_ms,
        is_up,
        error_message
      ) VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4,
        $5,
        $6::timestamptz,
        $5,
        $7,
        CASE WHEN $4 = 'up' THEN true ELSE false END,
        $8
      )`,
      [
        input.userId ?? null,
        input.websiteId,
        input.uptimeCheckId,
        input.status,
        input.statusCode,
        input.checkedAt.toISOString(),
        input.responseTimeMs,
        input.errorMessage,
      ],
    );
  } catch {
    // Backwards-compatible path for older schemas missing status/user_id columns.
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
        input.statusCode,
        input.responseTimeMs,
        input.status === "up",
        input.errorMessage,
      ],
    );
  }
}

export type WebsiteUptimeSnapshot = {
  websiteId: string;
  status: "up" | "down" | "degraded" | "error" | "unknown";
  lastCheckedAt: string | null;
  frequencyMinutes: number;
};

export type WebsiteUptimeHistoryItem = {
  id: string;
  checkedAt: string;
  status: "up" | "down" | "degraded" | "error";
  statusCode: number | null;
  responseTimeMs: number | null;
  errorMessage: string | null;
};

export async function ensureUptimeCheckForWebsite(input: {
  websiteId: string;
  userId: string;
  frequencyMinutes: number;
}): Promise<void> {
  const pool = getPool();
  const hasFrequencyMinutes = await hasPublicColumn("uptime_checks", "frequency_minutes");
  const hasEnabled = await hasPublicColumn("uptime_checks", "enabled");
  const hasUserId = await hasPublicColumn("uptime_checks", "user_id");
  const hasNextCheckAt = await hasPublicColumn("uptime_checks", "next_check_at");

  if (hasFrequencyMinutes && hasEnabled && hasUserId && hasNextCheckAt) {
    await pool.query(
      `INSERT INTO uptime_checks (
        website_id,
        user_id,
        enabled,
        frequency_minutes,
        next_check_at,
        updated_at
      ) VALUES (
        $1::uuid,
        $2::uuid,
        true,
        GREATEST($3::int, 1),
        now(),
        now()
      )
      ON CONFLICT (website_id)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        enabled = true,
        frequency_minutes = EXCLUDED.frequency_minutes,
        next_check_at = now(),
        updated_at = now()`,
      [input.websiteId, input.userId, input.frequencyMinutes],
    );
    return;
  }

  // Legacy schema fallback.
  await pool.query(
    `INSERT INTO uptime_checks (
      website_id,
      url,
      interval_seconds,
      is_enabled,
      updated_at
    )
    SELECT
      w.id,
      coalesce(nullif(trim(w.monitoring_url), ''), 'https://' || w.primary_domain),
      $2::int,
      true,
      now()
    FROM websites w
    WHERE w.id = $1::uuid
    ON CONFLICT (website_id)
    DO UPDATE SET
      interval_seconds = EXCLUDED.interval_seconds,
      is_enabled = true,
      updated_at = now()`,
    [input.websiteId, Math.max(60, input.frequencyMinutes * 60)],
  );
}

export async function getWebsiteUptimeSnapshot(
  websiteId: string,
): Promise<WebsiteUptimeSnapshot | null> {
  const pool = getPool();
  const hasFrequencyMinutes = await hasPublicColumn("uptime_checks", "frequency_minutes");
  const hasStatus = await hasPublicColumn("uptime_logs", "status");
  const hasLastCheckedAt = await hasPublicColumn("uptime_checks", "last_checked_at");

  const result = await (async () => {
    if (hasFrequencyMinutes && hasLastCheckedAt && hasStatus) {
      return await pool.query<{
        website_id: string;
        frequency_minutes: number;
        last_checked_at: string | null;
        status: "up" | "down" | "degraded" | "error" | null;
        is_up: boolean | null;
      }>(
        `SELECT
           uc.website_id,
           uc.frequency_minutes,
           uc.last_checked_at::text,
           ul.status,
           ul.is_up
         FROM uptime_checks uc
         LEFT JOIN LATERAL (
           SELECT status, is_up
           FROM uptime_logs
           WHERE website_id = uc.website_id
           ORDER BY checked_at DESC
           LIMIT 1
         ) ul ON true
         WHERE uc.website_id = $1::uuid
         LIMIT 1`,
        [websiteId],
      );
    }

    return pool.query<{
      website_id: string;
      frequency_minutes: number;
      last_checked_at: string | null;
      status: null;
      is_up: boolean | null;
    }>(
      `SELECT
         uc.website_id,
         GREATEST(coalesce(uc.interval_seconds, 1800) / 60, 1)::int AS frequency_minutes,
         null::text AS last_checked_at,
         null::text AS status,
         ul.is_up
       FROM uptime_checks uc
       LEFT JOIN LATERAL (
         SELECT is_up
         FROM uptime_logs
         WHERE website_id = uc.website_id
         ORDER BY checked_at DESC
         LIMIT 1
       ) ul ON true
       WHERE uc.website_id = $1::uuid
       LIMIT 1`,
      [websiteId],
    );
  })();
  const row = result.rows[0];
  if (!row) return null;
  const status =
    row.status ?? (row.is_up === null ? "unknown" : row.is_up ? "up" : "down");
  return {
    websiteId: row.website_id,
    frequencyMinutes: Number(row.frequency_minutes || 30),
    lastCheckedAt: row.last_checked_at,
    status,
  };
}

export async function getWebsiteUptimeHistory(
  websiteId: string,
  limit = 10,
): Promise<WebsiteUptimeHistoryItem[]> {
  const pool = getPool();
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const result = await (async () => {
    try {
      return await pool.query<{
        id: string;
        checked_at: string;
        status: "up" | "down" | "degraded" | "error" | null;
        is_up: boolean | null;
        status_code: number | null;
        http_status: number | null;
        response_time_ms: number | null;
        error_message: string | null;
      }>(
        `SELECT
           id::text,
           checked_at::text,
           status,
           is_up,
           status_code,
           http_status,
           response_time_ms,
           error_message
         FROM uptime_logs
         WHERE website_id = $1::uuid
         ORDER BY checked_at DESC
         LIMIT $2`,
        [websiteId, safeLimit],
      );
    } catch {
      return pool.query<{
        id: string;
        checked_at: string;
        status: null;
        is_up: boolean | null;
        status_code: null;
        http_status: number | null;
        response_time_ms: number | null;
        error_message: string | null;
      }>(
        `SELECT
           id::text,
           checked_at::text,
           null::text AS status,
           is_up,
           null::int AS status_code,
           http_status,
           response_time_ms,
           error_message
         FROM uptime_logs
         WHERE website_id = $1::uuid
         ORDER BY checked_at DESC
         LIMIT $2`,
        [websiteId, safeLimit],
      );
    }
  })();
  return result.rows.map((row) => ({
    id: row.id,
    checkedAt: row.checked_at,
    status: row.status ?? (row.is_up ? "up" : "down"),
    statusCode: row.status_code ?? row.http_status,
    responseTimeMs: row.response_time_ms,
    errorMessage: row.error_message,
  }));
}
