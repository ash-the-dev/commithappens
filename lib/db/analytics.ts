import { getPool } from "@/lib/db/pool";
import { CRAWLER_USER_AGENT_POSTGRES_REGEX } from "@/lib/ingestion/crawler-user-agent";

type CountByDay = { day: string; count: string };
type DistinctByDay = { day: string; distinct_sessions: string };
type AvgVitalRow = { metric_name: string; avg_value: string; samples: string };
type TopPageRow = { path: string; views: string };
type UptimeRow = {
  checks_24h: string;
  checks_up_24h: string;
  avg_response_24h: string | null;
};

export type SiteAnalyticsOverview = {
  sessions24h: number;
  sessions30d: number;
  pageviews24h: number;
  events24h: number;
  uniqueVisitors24h: number;
};

export type SiteAnalyticsPoint = {
  day: string;
  label: string;
  sessions: number;
  pageviews: number;
  events: number;
};

export type SiteVitalAverage = {
  metric: string;
  average: number;
  samples: number;
};

export type SiteTopPage = {
  path: string;
  views: number;
};

export type SiteUptime = {
  checks24h: number;
  checksUp24h: number;
  avgResponse24h: number;
  uptimePct24h: number;
  hasChecks24h: boolean;
};

export type SiteAnalytics = {
  overview: SiteAnalyticsOverview;
  timeline: SiteAnalyticsPoint[];
  vitalAverages: SiteVitalAverage[];
  topPages: SiteTopPage[];
  uptime: SiteUptime;
};

export type SiteLiveActivityItem = {
  id: string;
  type: "pageview" | "event";
  label: string;
  path: string | null;
  occurredAt: string;
  sessionId: string | null;
};

function toDateLabel(isoDay: string): string {
  const d = new Date(`${isoDay}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dayKeys(days: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

function rowsToMap(rows: CountByDay[]): Map<string, number> {
  return new Map(rows.map((r) => [r.day, Number(r.count)]));
}

export async function getSiteAnalytics(websiteId: string): Promise<SiteAnalytics> {
  const pool = getPool();

  const [
    overviewResult,
    sessionsDaily,
    pageviewsDaily,
    eventsDaily,
    vitals,
    topPages,
    uptime,
  ] = await Promise.all([
    pool.query<{
      sessions_24h: string;
      sessions_30d: string;
      pageviews_24h: string;
      events_24h: string;
      unique_visitors_24h: string;
    }>(
      `SELECT
         (SELECT count(DISTINCT p.session_id)::text
            FROM pageviews p
            INNER JOIN sessions s ON s.id = p.session_id
            WHERE p.website_id = $1
              AND p.occurred_at >= now() - interval '24 hours'
              AND (s.user_agent IS NULL OR s.user_agent !~* $2::text)) AS sessions_24h,
         (SELECT count(DISTINCT p.session_id)::text
            FROM pageviews p
            INNER JOIN sessions s ON s.id = p.session_id
            WHERE p.website_id = $1
              AND p.occurred_at >= now() - interval '30 days'
              AND (s.user_agent IS NULL OR s.user_agent !~* $2::text)) AS sessions_30d,
         (SELECT count(*)::text
            FROM pageviews p
            INNER JOIN sessions s ON s.id = p.session_id
            WHERE p.website_id = $1
              AND p.occurred_at >= now() - interval '24 hours'
              AND (s.user_agent IS NULL OR s.user_agent !~* $2::text)) AS pageviews_24h,
         (SELECT count(*)::text
            FROM events e
            INNER JOIN sessions s ON s.id = e.session_id
            WHERE e.website_id = $1
              AND e.occurred_at >= now() - interval '24 hours'
              AND (s.user_agent IS NULL OR s.user_agent !~* $2::text)) AS events_24h,
         (SELECT count(DISTINCT s.visitor_key)::text
            FROM pageviews p
            INNER JOIN sessions s ON s.id = p.session_id
            WHERE p.website_id = $1
              AND p.occurred_at >= now() - interval '24 hours'
              AND (s.user_agent IS NULL OR s.user_agent !~* $2::text)) AS unique_visitors_24h`,
      [websiteId, CRAWLER_USER_AGENT_POSTGRES_REGEX],
    ),
    pool.query<DistinctByDay>(
      `SELECT
         to_char((p.occurred_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day,
         count(DISTINCT p.session_id)::text AS distinct_sessions
       FROM pageviews p
       INNER JOIN sessions s ON s.id = p.session_id
       WHERE p.website_id = $1
         AND p.occurred_at >= now() - interval '30 days'
         AND (s.user_agent IS NULL OR s.user_agent !~* $2::text)
       GROUP BY 1
       ORDER BY 1`,
      [websiteId, CRAWLER_USER_AGENT_POSTGRES_REGEX],
    ),
    pool.query<CountByDay>(
      `SELECT to_char((p.occurred_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day, count(*)::text AS count
       FROM pageviews p
       INNER JOIN sessions s ON s.id = p.session_id
       WHERE p.website_id = $1
         AND p.occurred_at >= now() - interval '30 days'
         AND (s.user_agent IS NULL OR s.user_agent !~* $2::text)
       GROUP BY 1
       ORDER BY 1`,
      [websiteId, CRAWLER_USER_AGENT_POSTGRES_REGEX],
    ),
    pool.query<CountByDay>(
      `SELECT to_char((e.occurred_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day, count(*)::text AS count
       FROM events e
       INNER JOIN sessions s ON s.id = e.session_id
       WHERE e.website_id = $1
         AND e.occurred_at >= now() - interval '30 days'
         AND (s.user_agent IS NULL OR s.user_agent !~* $2::text)
       GROUP BY 1
       ORDER BY 1`,
      [websiteId, CRAWLER_USER_AGENT_POSTGRES_REGEX],
    ),
    pool.query<AvgVitalRow>(
      `SELECT w.metric_name, avg(w.value)::text AS avg_value, count(*)::text AS samples
       FROM web_vitals w
       LEFT JOIN sessions s ON s.id = w.session_id
       WHERE w.website_id = $1
         AND w.occurred_at >= now() - interval '7 days'
         AND (s.user_agent IS NULL OR s.user_agent !~* $2::text)
       GROUP BY w.metric_name
       ORDER BY w.metric_name`,
      [websiteId, CRAWLER_USER_AGENT_POSTGRES_REGEX],
    ),
    pool.query<TopPageRow>(
      `SELECT p.path, count(*)::text AS views
       FROM pageviews p
       INNER JOIN sessions s ON s.id = p.session_id
       WHERE p.website_id = $1
         AND p.occurred_at >= now() - interval '14 days'
         AND (s.user_agent IS NULL OR s.user_agent !~* $2::text)
       GROUP BY p.path
       ORDER BY views DESC
       LIMIT 6`,
      [websiteId, CRAWLER_USER_AGENT_POSTGRES_REGEX],
    ),
    (async () => {
      try {
        return await pool.query<UptimeRow>(
          `SELECT
             count(*)::text AS checks_24h,
             count(*) FILTER (
               WHERE coalesce(status, CASE WHEN is_up THEN 'up' ELSE 'down' END) = 'up'
             )::text AS checks_up_24h,
             avg(response_time_ms)::text AS avg_response_24h
           FROM uptime_logs
           WHERE website_id = $1
             AND checked_at >= now() - interval '24 hours'`,
          [websiteId],
        );
      } catch {
        return pool.query<UptimeRow>(
          `SELECT
             count(*)::text AS checks_24h,
             count(*) FILTER (WHERE is_up)::text AS checks_up_24h,
             avg(response_time_ms)::text AS avg_response_24h
           FROM uptime_logs
           WHERE website_id = $1
             AND checked_at >= now() - interval '24 hours'`,
          [websiteId],
        );
      }
    })(),
  ]);

  const overviewRow = overviewResult.rows[0];
  const dayOrder = dayKeys(30);
  const sessionsMap = new Map(
    sessionsDaily.rows.map((row) => [row.day, Number(row.distinct_sessions)]),
  );
  const pageviewsMap = rowsToMap(pageviewsDaily.rows);
  const eventsMap = rowsToMap(eventsDaily.rows);

  const timeline = dayOrder.map((day) => ({
    day,
    label: toDateLabel(day),
    sessions: sessionsMap.get(day) ?? 0,
    pageviews: pageviewsMap.get(day) ?? 0,
    events: eventsMap.get(day) ?? 0,
  }));

  const vitalAverages = vitals.rows.map((row) => ({
    metric: row.metric_name,
    average: Number(row.avg_value),
    samples: Number(row.samples),
  }));

  const topPageStats = topPages.rows.map((row) => ({
    path: row.path,
    views: Number(row.views),
  }));

  const up = uptime.rows[0] ?? {
    checks_24h: "0",
    checks_up_24h: "0",
    avg_response_24h: "0",
  };

  const checks24h = Number(up.checks_24h || 0);
  const checksUp24h = Number(up.checks_up_24h || 0);

  return {
    overview: {
      sessions24h: Number(overviewRow?.sessions_24h || 0),
      sessions30d: Number(overviewRow?.sessions_30d || 0),
      pageviews24h: Number(overviewRow?.pageviews_24h || 0),
      events24h: Number(overviewRow?.events_24h || 0),
      uniqueVisitors24h: Number(overviewRow?.unique_visitors_24h || 0),
    },
    timeline,
    vitalAverages,
    topPages: topPageStats,
    uptime: {
      checks24h,
      checksUp24h,
      avgResponse24h: Number(up.avg_response_24h || 0),
      uptimePct24h: checks24h > 0 ? (checksUp24h / checks24h) * 100 : 0,
      hasChecks24h: checks24h > 0,
    },
  };
}

export async function getSiteLiveActivity(
  websiteId: string,
  limit = 25,
): Promise<SiteLiveActivityItem[]> {
  const pool = getPool();
  const safeLimit = Math.max(1, Math.min(limit, 100));

  const [pageviewsResult, eventsResult] = await Promise.all([
    pool.query<{
      id: string;
      path: string;
      title: string | null;
      occurred_at: Date;
      session_id: string;
    }>(
      `SELECT p.id, p.path, p.title, p.occurred_at, p.session_id
       FROM pageviews p
       INNER JOIN sessions s ON s.id = p.session_id
       WHERE p.website_id = $1
         AND (s.user_agent IS NULL OR s.user_agent !~* $2::text)
       ORDER BY p.occurred_at DESC
       LIMIT $3`,
      [websiteId, CRAWLER_USER_AGENT_POSTGRES_REGEX, safeLimit],
    ),
    (async () => {
      try {
        return await pool.query<{
          id: string;
          name: string;
          path: string | null;
          occurred_at: Date;
          session_id: string;
        }>(
          `SELECT e.id, e.name, e.path, e.occurred_at, e.session_id
           FROM events e
           INNER JOIN sessions s ON s.id = e.session_id
           WHERE e.website_id = $1
             AND (s.user_agent IS NULL OR s.user_agent !~* $2::text)
           ORDER BY e.occurred_at DESC
           LIMIT $3`,
          [websiteId, CRAWLER_USER_AGENT_POSTGRES_REGEX, safeLimit],
        );
      } catch {
        return pool.query<{
          id: string;
          name: string;
          occurred_at: Date;
          session_id: string;
        }>(
          `SELECT e.id, e.name, e.occurred_at, e.session_id
           FROM events e
           INNER JOIN sessions s ON s.id = e.session_id
           WHERE e.website_id = $1
             AND (s.user_agent IS NULL OR s.user_agent !~* $2::text)
           ORDER BY e.occurred_at DESC
           LIMIT $3`,
          [websiteId, CRAWLER_USER_AGENT_POSTGRES_REGEX, safeLimit],
        );
      }
    })(),
  ]);

  const items: SiteLiveActivityItem[] = [
    ...pageviewsResult.rows.map((row) => ({
      id: row.id,
      type: "pageview" as const,
      label: row.title?.trim() ? row.title : row.path,
      path: row.path,
      occurredAt: row.occurred_at.toISOString(),
      sessionId: row.session_id ?? null,
    })),
    ...eventsResult.rows.map((row) => ({
      id: row.id,
      type: "event" as const,
      label: row.name,
      path: "path" in row ? (row.path as string | null) : null,
      occurredAt: row.occurred_at.toISOString(),
      sessionId: row.session_id ?? null,
    })),
  ];

  items.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  return items.slice(0, safeLimit);
}
