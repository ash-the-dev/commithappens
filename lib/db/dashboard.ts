import { getPool } from "@/lib/db/pool";
import { CRAWLER_USER_AGENT_POSTGRES_REGEX } from "@/lib/ingestion/crawler-user-agent";

type DbSiteRow = {
  id: string;
  name: string;
  primary_domain: string;
  is_active: boolean;
  created_at: Date;
};

type DbReportRow = {
  site_id: string;
  created_at: string;
  report_json: unknown;
  rn: string;
};

type DbSessionAggRow = {
  website_id: string;
  visits_30d: string;
  pageviews_24h: string;
  visits_24h: string;
  last_pageview_at: string | null;
};

type ParsedReportStats = {
  healthScore: number | null;
  issuesFound: number | null;
  healthyPages: number | null;
  topIssue: string | null;
};

export type DashboardSiteSnapshot = {
  id: string;
  name: string;
  domain: string;
  isActive: boolean;
  createdAt: Date;
  lastCheckedAt: string | null;
  visits30d: number | null;
  visits24h: number | null;
  pageviews24h: number | null;
  lastSeenAt: string | null;
  healthScore: number | null;
  healthDelta: number | null;
  issuesCurrent: number | null;
  issuesDelta: number | null;
  healthyPages: number | null;
  topIssue: string | null;
};

export type DashboardGlobalSummary = {
  totalSites: number;
  sitesNeedingAttention: number;
  regressionsDetected: number;
  stableSites: number;
  sitesWithoutScans: number;
};

function toCountLabel(value: number): string {
  return value === 1 ? "1 issue" : `${value} issues`;
}

function parseReportStats(report: unknown): ParsedReportStats {
  if (!report || typeof report !== "object") {
    return {
      healthScore: null,
      issuesFound: null,
      healthyPages: null,
      topIssue: null,
    };
  }
  const payload = report as {
    insights?: {
      overview?: {
        healthScore?: number;
        issuesFound?: number;
      };
    };
    raw?: {
      summary?: {
        healthy?: number;
        clientErrors?: number;
        serverErrors?: number;
        redirects?: number;
        other?: number;
      };
    };
  };
  const healthScore = payload.insights?.overview?.healthScore;
  const issuesFound = payload.insights?.overview?.issuesFound;
  const healthyPages = payload.raw?.summary?.healthy;
  const summary = payload.raw?.summary;

  let topIssue: string | null = null;
  if (summary) {
    const buckets = [
      { label: "404 pages", value: summary.clientErrors ?? 0 },
      { label: "5xx pages", value: summary.serverErrors ?? 0 },
      { label: "redirect responses", value: summary.redirects ?? 0 },
      { label: "unknown responses", value: summary.other ?? 0 },
    ].sort((a, b) => b.value - a.value);
    if (buckets[0] && buckets[0].value > 0) {
      topIssue = `${buckets[0].label} (${buckets[0].value})`;
    }
  }

  return {
    healthScore: Number.isFinite(healthScore) ? Number(healthScore) : null,
    issuesFound: Number.isFinite(issuesFound) ? Number(issuesFound) : null,
    healthyPages: Number.isFinite(healthyPages) ? Number(healthyPages) : null,
    topIssue,
  };
}

function computeGlobalSummary(sites: DashboardSiteSnapshot[]): DashboardGlobalSummary {
  let sitesNeedingAttention = 0;
  let regressionsDetected = 0;
  let stableSites = 0;
  let sitesWithoutScans = 0;

  for (const site of sites) {
    const hasScan = site.healthScore !== null || site.issuesCurrent !== null;
    if (!hasScan) {
      sitesWithoutScans += 1;
      continue;
    }

    const hasAttentionFlag =
      (site.healthScore !== null && site.healthScore < 85) ||
      (site.issuesCurrent !== null && site.issuesCurrent > 0);
    if (hasAttentionFlag) sitesNeedingAttention += 1;

    const regressed =
      (site.issuesDelta !== null && site.issuesDelta > 0) ||
      (site.healthDelta !== null && site.healthDelta < 0);
    if (regressed) {
      regressionsDetected += 1;
    } else {
      stableSites += 1;
    }
  }

  return {
    totalSites: sites.length,
    sitesNeedingAttention,
    regressionsDetected,
    stableSites,
    sitesWithoutScans,
  };
}

export async function getDashboardSiteSnapshots(userId: string): Promise<{
  sites: DashboardSiteSnapshot[];
  summary: DashboardGlobalSummary;
}> {
  const pool = getPool();

  const sitesResult = await pool.query<DbSiteRow>(
    `SELECT id, name, primary_domain, is_active, created_at
     FROM websites
     WHERE owner_user_id = $1
       AND is_active = true
       AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [userId],
  );
  if (sitesResult.rows.length === 0) {
    return {
      sites: [],
      summary: {
        totalSites: 0,
        sitesNeedingAttention: 0,
        regressionsDetected: 0,
        stableSites: 0,
        sitesWithoutScans: 0,
      },
    };
  }

  const siteIds = sitesResult.rows.map((site) => site.id);
  const reportKeys = Array.from(
    new Set([
      ...sitesResult.rows.map((site) => site.id),
      ...sitesResult.rows.map((site) => site.primary_domain),
      "default",
    ]),
  );

  const reportsResult = await pool.query<DbReportRow>(
    `SELECT site_id, created_at::text, report_json, rn::text
     FROM (
       SELECT
         site_id,
         created_at,
         report_json,
         row_number() OVER (PARTITION BY site_id ORDER BY created_at DESC) AS rn
       FROM response_code_reports
       WHERE site_id = ANY($1::text[])
     ) ranked
     WHERE rn <= 2`,
    [reportKeys],
  );

  const sessionsResult = await pool.query<DbSessionAggRow>(
    `SELECT
       p.website_id,
       count(DISTINCT p.session_id) FILTER (WHERE p.occurred_at >= now() - interval '30 days')::text AS visits_30d,
       count(*) FILTER (WHERE p.occurred_at >= now() - interval '24 hours')::text AS pageviews_24h,
       count(DISTINCT p.session_id) FILTER (WHERE p.occurred_at >= now() - interval '24 hours')::text AS visits_24h,
       max(p.occurred_at)::text AS last_pageview_at
     FROM pageviews p
     INNER JOIN sessions s ON s.id = p.session_id
     WHERE p.website_id = ANY($1::uuid[])
       AND (s.user_agent IS NULL OR s.user_agent !~* $2::text)
     GROUP BY p.website_id`,
    [siteIds, CRAWLER_USER_AGENT_POSTGRES_REGEX],
  );

  const sessionsBySite = new Map<string, DbSessionAggRow>();
  for (const row of sessionsResult.rows) {
    sessionsBySite.set(row.website_id, row);
  }

  const reportsByKey = new Map<
    string,
    { current: DbReportRow | null; previous: DbReportRow | null }
  >();
  for (const row of reportsResult.rows) {
    const entry = reportsByKey.get(row.site_id) ?? { current: null, previous: null };
    if (Number(row.rn) === 1) entry.current = row;
    if (Number(row.rn) === 2) entry.previous = row;
    reportsByKey.set(row.site_id, entry);
  }

  const sites: DashboardSiteSnapshot[] = sitesResult.rows.map((site) => {
    const sessions = sessionsBySite.get(site.id);
    const reportPair =
      reportsByKey.get(site.id) ??
      reportsByKey.get(site.primary_domain) ??
      (sitesResult.rows.length === 1 ? reportsByKey.get("default") : undefined) ?? {
        current: null,
        previous: null,
      };
    const currentStats = parseReportStats(reportPair.current?.report_json ?? null);
    const previousStats = parseReportStats(reportPair.previous?.report_json ?? null);

    const issuesDelta =
      currentStats.issuesFound !== null && previousStats.issuesFound !== null
        ? currentStats.issuesFound - previousStats.issuesFound
        : null;
    const healthDelta =
      currentStats.healthScore !== null && previousStats.healthScore !== null
        ? currentStats.healthScore - previousStats.healthScore
        : null;

    const topIssue =
      currentStats.topIssue ??
      (currentStats.issuesFound !== null && currentStats.issuesFound > 0
        ? `${toCountLabel(currentStats.issuesFound)} detected`
        : null);

    return {
      id: site.id,
      name: site.name,
      domain: site.primary_domain,
      isActive: site.is_active,
      createdAt: site.created_at,
      lastCheckedAt: reportPair.current?.created_at ?? null,
      visits30d: sessions ? Number(sessions.visits_30d) : null,
      visits24h: sessions ? Number(sessions.visits_24h) : null,
      pageviews24h: sessions ? Number(sessions.pageviews_24h) : null,
      lastSeenAt: sessions?.last_pageview_at ?? null,
      healthScore: currentStats.healthScore,
      healthDelta,
      issuesCurrent: currentStats.issuesFound,
      issuesDelta,
      healthyPages: currentStats.healthyPages,
      topIssue,
    };
  });

  return {
    sites,
    summary: computeGlobalSummary(sites),
  };
}
