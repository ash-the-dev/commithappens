import "server-only";
import { getPool } from "@/lib/db/pool";

export type AdminStatCard = {
  label: string;
  value: string;
  detail: string;
};

export type AdminUptimeFailure = {
  siteId: string | null;
  url: string;
  statusCode: number | null;
  errorMessage: string | null;
  checkedAt: string;
};

export type AdminRecentAlert = {
  id: string;
  websiteId: string | null;
  severity: string;
  title: string;
  status: string | null;
  detectedAt: string;
};

export type AdminDashboardData = {
  cards: AdminStatCard[];
  latestUptimeFailures: AdminUptimeFailure[];
  recentAlerts: AdminRecentAlert[];
};

function compactNumber(value: string | number | null | undefined): string {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(
    Number(value ?? 0),
  );
}

async function tableExists(tableName: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ exists: boolean }>(
    `SELECT to_regclass($1) IS NOT NULL AS exists`,
    [`public.${tableName}`],
  );
  return result.rows[0]?.exists === true;
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const pool = getPool();
  const hasDashboardNotifications = await tableExists("dashboard_notifications");

  const [
    counts,
    uptimeFailures,
    seoAiPages,
    alertCount,
    recentAlerts,
  ] = await Promise.all([
    pool.query<{
      total_users: string;
      new_users_today: string;
      new_users_7d: string;
      total_websites: string;
      active_monitors: string;
    }>(
      `SELECT
         (SELECT count(*)::text FROM users) AS total_users,
         (SELECT count(*)::text FROM users WHERE created_at >= date_trunc('day', now())) AS new_users_today,
         (SELECT count(*)::text FROM users WHERE created_at >= now() - interval '7 days') AS new_users_7d,
         (SELECT count(*)::text FROM websites WHERE deleted_at IS NULL) AS total_websites,
         (SELECT count(*)::text FROM uptime_monitors WHERE enabled = true) AS active_monitors`,
    ),
    pool.query<AdminUptimeFailure>(
      `SELECT
         site_id::text AS "siteId",
         url,
         status_code AS "statusCode",
         error_message AS "errorMessage",
         checked_at::text AS "checkedAt"
       FROM uptime_checks
       WHERE is_up = false
       ORDER BY checked_at DESC
       LIMIT 6`,
    ),
    pool.query<{ count: string }>(
      `SELECT count(*)::text
       FROM seo_page_reports
       WHERE ai_recommendations IS NOT NULL`,
    ),
    hasDashboardNotifications
      ? pool.query<{ count: string }>(
          `SELECT count(*)::text
           FROM dashboard_notifications
           WHERE status IN ('unread', 'read')`,
        )
      : pool.query<{ count: string }>(
          `SELECT count(*)::text
           FROM alerts
           WHERE resolved_at IS NULL`,
        ),
    hasDashboardNotifications
      ? pool.query<AdminRecentAlert>(
          `SELECT
             id::text,
             website_id::text AS "websiteId",
             severity,
             title,
             status,
             detected_at::text AS "detectedAt"
           FROM dashboard_notifications
           ORDER BY detected_at DESC
           LIMIT 6`,
        )
      : pool.query<AdminRecentAlert>(
          `SELECT
             id::text,
             website_id::text AS "websiteId",
             severity,
             title,
             CASE WHEN resolved_at IS NULL THEN 'open' ELSE 'resolved' END AS status,
             triggered_at::text AS "detectedAt"
           FROM alerts
           ORDER BY triggered_at DESC
           LIMIT 6`,
        ),
  ]);

  const row = counts.rows[0];
  const latestFailures = uptimeFailures.rows;
  const recentAlertRows = recentAlerts.rows;

  return {
    cards: [
      {
        label: "Total Users",
        value: compactNumber(row?.total_users),
        detail: "Everyone who wandered into the chaos.",
      },
      {
        label: "New Today",
        value: compactNumber(row?.new_users_today),
        detail: "Fresh accounts since midnight.",
      },
      {
        label: "New Last 7 Days",
        value: compactNumber(row?.new_users_7d),
        detail: "Weekly signup pulse.",
      },
      {
        label: "Total Websites",
        value: compactNumber(row?.total_websites),
        detail: "Tracked projects, minus the deleted ghosts.",
      },
      {
        label: "Active Monitors",
        value: compactNumber(row?.active_monitors),
        detail: "URLs the uptime dragon is watching.",
      },
      {
        label: "Latest Uptime Failures",
        value: compactNumber(latestFailures.length),
        detail: "Recent checks that face-planted.",
      },
      {
        label: "SEO AI Pages",
        value: compactNumber(seoAiPages.rows[0]?.count),
        detail: "Pages with generated recommendations.",
      },
      {
        label: "Recent Alerts",
        value: compactNumber(alertCount.rows[0]?.count),
        detail: "Open dashboard nags worth eyeballing.",
      },
    ],
    latestUptimeFailures: latestFailures,
    recentAlerts: recentAlertRows,
  };
}
