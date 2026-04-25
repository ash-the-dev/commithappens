import { getPool } from "@/lib/db/pool";

export type UptimeProbeStatus = "up" | "down";

export type DueUptimeMonitor = {
  id: string;
  user_id: string | null;
  site_id: string | null;
  url: string;
  frequency_minutes: number;
};

export type InsertUptimeCheckInput = {
  monitorId: string;
  userId?: string | null;
  siteId?: string | null;
  url: string;
  checkedAt: Date;
  statusCode: number | null;
  responseTimeMs: number | null;
  isUp: boolean;
  errorMessage: string | null;
  frequencyMinutes: number;
};

export type WebsiteUptimeSnapshot = {
  websiteId: string;
  status: "up" | "down" | "unknown";
  lastCheckedAt: string | null;
  frequencyMinutes: number;
  lastResponseTimeMs: number | null;
  lastStatusCode: number | null;
  uptimePct24h: number | null;
  checks24h: number;
  checksUp24h: number;
  monitorUrl: string | null;
  monitorEnabled: boolean;
};

export type WebsiteUptimeHistoryItem = {
  id: string;
  checkedAt: string;
  status: UptimeProbeStatus;
  statusCode: number | null;
  responseTimeMs: number | null;
  errorMessage: string | null;
  url: string | null;
};

const FREE_TIER_MIN_PROBE_GAP_MIN = 30;

function defaultMonitorUrl(domain: string, monitoringUrl?: string | null): string {
  const explicit = monitoringUrl?.trim();
  if (explicit) return explicit;
  return /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
}

export async function ensureUptimeChecksForActiveWebsites(): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO uptime_monitors (
       user_id,
       site_id,
       url,
       enabled,
       frequency_minutes,
       next_check_at,
       created_at,
       updated_at
     )
     SELECT
       w.owner_user_id,
       w.id,
       coalesce(nullif(trim(w.monitoring_url), ''), 'https://' || w.primary_domain),
       true,
       CASE
         WHEN lower(u.email) = 'ashthedev0@gmail.com' THEN 5
         WHEN us.status IN ('trialing', 'active', 'past_due') AND us.plan_key IN ('unlimited', 'committed') THEN 5
         WHEN us.status IN ('trialing', 'active', 'past_due') AND us.plan_key = 'situationship' THEN 15
         ELSE $1::int
       END,
       now(),
       now(),
       now()
     FROM websites w
     JOIN users u ON u.id = w.owner_user_id
     LEFT JOIN user_subscriptions us ON us.user_id = w.owner_user_id
     LEFT JOIN uptime_monitors existing ON existing.site_id = w.id
     WHERE w.deleted_at IS NULL
       AND w.is_active = true
       AND existing.id IS NULL`,
    [FREE_TIER_MIN_PROBE_GAP_MIN],
  );
}

export async function getDueUptimeMonitors(limit = 50): Promise<DueUptimeMonitor[]> {
  const pool = getPool();
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const result = await pool.query<{
    id: string;
    user_id: string | null;
    site_id: string | null;
    url: string | null;
    frequency_minutes: string | number | null;
  }>(
    `SELECT
       m.id,
       m.user_id::text,
       m.site_id::text,
       coalesce(nullif(trim(m.url), ''), nullif(trim(w.monitoring_url), ''), 'https://' || w.primary_domain) AS url,
       coalesce(m.frequency_minutes, $1)::text AS frequency_minutes
     FROM uptime_monitors m
     LEFT JOIN websites w ON w.id = m.site_id
     WHERE m.enabled = true
       AND (m.next_check_at IS NULL OR m.next_check_at <= now())
       AND (w.id IS NULL OR (w.is_active = true AND w.deleted_at IS NULL))
     ORDER BY m.next_check_at ASC NULLS FIRST, m.created_at ASC
     LIMIT $2`,
    [FREE_TIER_MIN_PROBE_GAP_MIN, safeLimit],
  );

  return result.rows
    .filter((row) => typeof row.url === "string" && row.url.trim().length > 0)
    .map((row) => ({
      id: row.id,
      user_id: row.user_id,
      site_id: row.site_id,
      url: row.url!,
      frequency_minutes: Math.max(1, Number(row.frequency_minutes ?? FREE_TIER_MIN_PROBE_GAP_MIN)),
    }));
}

export async function recordUptimeCheck(input: InsertUptimeCheckInput): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  const checkedAt = input.checkedAt.toISOString();
  const frequencyMinutes = Math.max(1, input.frequencyMinutes);
  const nextCheckAt = new Date(input.checkedAt.getTime() + frequencyMinutes * 60_000).toISOString();

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO uptime_checks (
         user_id,
         site_id,
         url,
         status_code,
         response_time_ms,
         is_up,
         error_message,
         checked_at
       ) VALUES (
         $1::uuid,
         $2::uuid,
         $3,
         $4,
         $5,
         $6,
         $7,
         $8::timestamptz
       )`,
      [
        input.userId ?? null,
        input.siteId ?? null,
        input.url,
        input.statusCode,
        input.responseTimeMs,
        input.isUp,
        input.errorMessage,
        checkedAt,
      ],
    );
    await client.query(
      `UPDATE uptime_monitors
       SET last_checked_at = $2::timestamptz,
           next_check_at = $3::timestamptz,
           updated_at = now()
       WHERE id = $1::uuid`,
      [input.monitorId, checkedAt, nextCheckAt],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function ensureUptimeCheckForWebsite(input: {
  websiteId: string;
  userId: string;
  frequencyMinutes: number;
}): Promise<void> {
  const pool = getPool();
  const site = await pool.query<{
    id: string;
    primary_domain: string;
    monitoring_url: string | null;
  }>(
    `SELECT id, primary_domain, monitoring_url
     FROM websites
     WHERE id = $1::uuid
       AND deleted_at IS NULL
     LIMIT 1`,
    [input.websiteId],
  );
  const row = site.rows[0];
  if (!row) return;

  const url = defaultMonitorUrl(row.primary_domain, row.monitoring_url);
  const updated = await pool.query(
    `UPDATE uptime_monitors
     SET user_id = $2::uuid,
         url = coalesce(nullif(trim(url), ''), $3),
         enabled = true,
         frequency_minutes = GREATEST($4::int, 1),
         next_check_at = coalesce(next_check_at, now()),
         updated_at = now()
     WHERE site_id = $1::uuid`,
    [input.websiteId, input.userId, url, input.frequencyMinutes],
  );

  if ((updated.rowCount ?? 0) > 0) return;

  await pool.query(
    `INSERT INTO uptime_monitors (
       user_id,
       site_id,
       url,
       enabled,
       frequency_minutes,
       next_check_at,
       created_at,
       updated_at
     ) VALUES ($1::uuid, $2::uuid, $3, true, GREATEST($4::int, 1), now(), now(), now())`,
    [input.userId, input.websiteId, url, input.frequencyMinutes],
  );
}

export async function getWebsiteUptimeSnapshot(
  websiteId: string,
): Promise<WebsiteUptimeSnapshot | null> {
  const pool = getPool();
  const result = await pool.query<{
    website_id: string;
    frequency_minutes: string | number | null;
    monitor_url: string | null;
    monitor_enabled: boolean | null;
    checked_at: string | null;
    is_up: boolean | null;
    status_code: number | null;
    response_time_ms: number | null;
    checks_24h: string;
    checks_up_24h: string;
  }>(
    `SELECT
       w.id AS website_id,
       coalesce(m.frequency_minutes, $2)::text AS frequency_minutes,
       m.url AS monitor_url,
       coalesce(m.enabled, false) AS monitor_enabled,
       latest.checked_at::text,
       latest.is_up,
       latest.status_code,
       latest.response_time_ms,
       coalesce(stats.checks_24h, 0)::text AS checks_24h,
       coalesce(stats.checks_up_24h, 0)::text AS checks_up_24h
     FROM websites w
     LEFT JOIN LATERAL (
       SELECT id, url, enabled, frequency_minutes
       FROM uptime_monitors
       WHERE site_id = w.id
       ORDER BY created_at ASC
       LIMIT 1
     ) m ON true
     LEFT JOIN LATERAL (
       SELECT checked_at, is_up, status_code, response_time_ms
       FROM uptime_checks
       WHERE site_id = w.id
       ORDER BY checked_at DESC
       LIMIT 1
     ) latest ON true
     LEFT JOIN LATERAL (
       SELECT
         count(*)::int AS checks_24h,
         count(*) FILTER (WHERE is_up = true)::int AS checks_up_24h
       FROM uptime_checks
       WHERE site_id = w.id
         AND checked_at >= now() - interval '24 hours'
     ) stats ON true
     WHERE w.id = $1::uuid
     LIMIT 1`,
    [websiteId, FREE_TIER_MIN_PROBE_GAP_MIN],
  );

  const row = result.rows[0];
  if (!row) return null;
  const checks24h = Number(row.checks_24h ?? 0);
  const checksUp24h = Number(row.checks_up_24h ?? 0);
  const status = row.is_up == null ? "unknown" : row.is_up ? "up" : "down";

  return {
    websiteId: row.website_id,
    status,
    lastCheckedAt: row.checked_at,
    frequencyMinutes: Number(row.frequency_minutes || FREE_TIER_MIN_PROBE_GAP_MIN),
    lastResponseTimeMs: row.response_time_ms,
    lastStatusCode: row.status_code,
    uptimePct24h: checks24h > 0 ? (checksUp24h / checks24h) * 100 : null,
    checks24h,
    checksUp24h,
    monitorUrl: row.monitor_url,
    monitorEnabled: row.monitor_enabled === true,
  };
}

export async function getWebsiteUptimeHistory(
  websiteId: string,
  limit = 10,
): Promise<WebsiteUptimeHistoryItem[]> {
  const pool = getPool();
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const result = await pool.query<{
    id: string;
    checked_at: string;
    is_up: boolean;
    status_code: number | null;
    response_time_ms: number | null;
    error_message: string | null;
    url: string | null;
  }>(
    `SELECT
       id::text,
       checked_at::text,
       is_up,
       status_code,
       response_time_ms,
       error_message,
       url
     FROM uptime_checks
     WHERE site_id = $1::uuid
     ORDER BY checked_at DESC
     LIMIT $2`,
    [websiteId, safeLimit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    checkedAt: row.checked_at,
    status: row.is_up ? "up" : "down",
    statusCode: row.status_code,
    responseTimeMs: row.response_time_ms,
    errorMessage: row.error_message,
    url: row.url,
  }));
}
