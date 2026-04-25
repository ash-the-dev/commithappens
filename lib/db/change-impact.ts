import { getPool } from "@/lib/db/pool";
import { getChangeLogById, listChangeLogsForWebsite, type DbChangeLog } from "@/lib/db/change-logs";

const IMPACT_RULES = {
  defaultWindowHours: 24,
  significantChangePct: 25,
  sampleTopLimit: 5,
  recentChangesLimit: 8,
} as const;

type ChangeImpactCaps = {
  eventsIsConversion: boolean;
  sessionsRiskScore: boolean;
};

let impactCapsCache: ChangeImpactCaps | null = null;

export type ChangeImpactMetrics = {
  sessions_before: number;
  sessions_after: number;
  sessions_percent_change: number;
  pageviews_before: number;
  pageviews_after: number;
  pageviews_percent_change: number;
  events_before: number;
  events_after: number;
  events_percent_change: number;
  conversions_before: number | null;
  conversions_after: number | null;
  conversions_percent_change: number | null;
  uptime_failures_before: number;
  uptime_failures_after: number;
  risk_sessions_before: number | null;
  risk_sessions_after: number | null;
};

export type ChangeImpactResult = {
  change_log_id: string;
  website_id: string;
  title: string;
  change_type: string | null;
  created_at: string;
  summary: string;
  metrics: ChangeImpactMetrics;
  flags: string[];
  notable_differences: string[];
};

function pctChange(after: number, before: number): number {
  if (before === 0) {
    if (after === 0) return 0;
    return 100;
  }
  return ((after - before) / before) * 100;
}

function fmtPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function windowDates(createdAt: Date, windowHours: number) {
  const afterStart = new Date(createdAt);
  const afterEnd = new Date(createdAt);
  afterEnd.setHours(afterEnd.getHours() + windowHours);
  const beforeEnd = new Date(createdAt);
  const beforeStart = new Date(createdAt);
  beforeStart.setHours(beforeStart.getHours() - windowHours);
  return { beforeStart, beforeEnd, afterStart, afterEnd };
}

async function getImpactCaps(): Promise<ChangeImpactCaps> {
  if (impactCapsCache) return impactCapsCache;
  const pool = getPool();
  const result = await pool.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND (
         (table_name = 'events' AND column_name = 'is_conversion')
         OR (table_name = 'sessions' AND column_name = 'risk_score')
       )`,
  );
  const has = (table: string, col: string) =>
    result.rows.some((r) => r.table_name === table && r.column_name === col);
  impactCapsCache = {
    eventsIsConversion: has("events", "is_conversion"),
    sessionsRiskScore: has("sessions", "risk_score"),
  };
  return impactCapsCache;
}

async function getTopCountsForWindow(
  websiteId: string,
  table: "pageviews" | "events",
  keyCol: "path" | "name",
  startIso: string,
  endIso: string,
) {
  const pool = getPool();
  const result = await pool.query<{ label: string; count: string }>(
    `SELECT ${keyCol} AS label, count(*)::text AS count
     FROM ${table}
     WHERE website_id = $1::uuid
       AND occurred_at >= $2::timestamptz
       AND occurred_at < $3::timestamptz
     GROUP BY 1
     ORDER BY count DESC
     LIMIT $4`,
    [websiteId, startIso, endIso, IMPACT_RULES.sampleTopLimit],
  );
  return result.rows.map((r) => ({ label: r.label, count: Number(r.count) }));
}

function compareTopDiffs(
  before: Array<{ label: string; count: number }>,
  after: Array<{ label: string; count: number }>,
  kind: "page" | "event",
): string[] {
  const beforeMap = new Map(before.map((row) => [row.label, row.count]));
  const diffs: Array<{ label: string; pct: number; before: number; after: number }> = [];
  for (const row of after) {
    const b = beforeMap.get(row.label) ?? 0;
    const pct = pctChange(row.count, b);
    diffs.push({ label: row.label, pct, before: b, after: row.count });
  }
  diffs.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  return diffs.slice(0, 2).map((d) => {
    if (kind === "page") {
      return `Page ${d.label} shifted from ${d.before} to ${d.after} views (${fmtPct(d.pct)}).`;
    }
    return `Event ${d.label} shifted from ${d.before} to ${d.after} occurrences (${fmtPct(d.pct)}).`;
  });
}

async function computeImpactForChange(
  change: DbChangeLog,
  windowHours = IMPACT_RULES.defaultWindowHours,
): Promise<ChangeImpactResult> {
  const pool = getPool();
  const caps = await getImpactCaps();
  const { beforeStart, beforeEnd, afterStart, afterEnd } = windowDates(change.created_at, windowHours);

  const [countRows, topPagesBefore, topPagesAfter, topEventsBefore, topEventsAfter] =
    await Promise.all([
      pool.query<{
        sessions_before: string;
        sessions_after: string;
        pageviews_before: string;
        pageviews_after: string;
        events_before: string;
        events_after: string;
        uptime_failures_before: string;
        uptime_failures_after: string;
      }>(
        `SELECT
          (SELECT count(*)::text FROM sessions s WHERE s.website_id = $1::uuid AND s.started_at >= $2::timestamptz AND s.started_at < $3::timestamptz) AS sessions_before,
          (SELECT count(*)::text FROM sessions s WHERE s.website_id = $1::uuid AND s.started_at >= $4::timestamptz AND s.started_at < $5::timestamptz) AS sessions_after,
          (SELECT count(*)::text FROM pageviews p WHERE p.website_id = $1::uuid AND p.occurred_at >= $2::timestamptz AND p.occurred_at < $3::timestamptz) AS pageviews_before,
          (SELECT count(*)::text FROM pageviews p WHERE p.website_id = $1::uuid AND p.occurred_at >= $4::timestamptz AND p.occurred_at < $5::timestamptz) AS pageviews_after,
          (SELECT count(*)::text FROM events e WHERE e.website_id = $1::uuid AND e.occurred_at >= $2::timestamptz AND e.occurred_at < $3::timestamptz) AS events_before,
          (SELECT count(*)::text FROM events e WHERE e.website_id = $1::uuid AND e.occurred_at >= $4::timestamptz AND e.occurred_at < $5::timestamptz) AS events_after,
          (SELECT count(*)::text FROM uptime_checks u WHERE u.site_id = $1::uuid AND u.checked_at >= $2::timestamptz AND u.checked_at < $3::timestamptz AND u.is_up = false) AS uptime_failures_before,
          (SELECT count(*)::text FROM uptime_checks u WHERE u.site_id = $1::uuid AND u.checked_at >= $4::timestamptz AND u.checked_at < $5::timestamptz AND u.is_up = false) AS uptime_failures_after`,
        [
          change.website_id,
          beforeStart.toISOString(),
          beforeEnd.toISOString(),
          afterStart.toISOString(),
          afterEnd.toISOString(),
        ],
      ),
      getTopCountsForWindow(
        change.website_id,
        "pageviews",
        "path",
        beforeStart.toISOString(),
        beforeEnd.toISOString(),
      ),
      getTopCountsForWindow(
        change.website_id,
        "pageviews",
        "path",
        afterStart.toISOString(),
        afterEnd.toISOString(),
      ),
      getTopCountsForWindow(
        change.website_id,
        "events",
        "name",
        beforeStart.toISOString(),
        beforeEnd.toISOString(),
      ),
      getTopCountsForWindow(
        change.website_id,
        "events",
        "name",
        afterStart.toISOString(),
        afterEnd.toISOString(),
      ),
    ]);

  const row = countRows.rows[0];
  const sessionsBefore = Number(row?.sessions_before ?? 0);
  const sessionsAfter = Number(row?.sessions_after ?? 0);
  const pageviewsBefore = Number(row?.pageviews_before ?? 0);
  const pageviewsAfter = Number(row?.pageviews_after ?? 0);
  const eventsBefore = Number(row?.events_before ?? 0);
  const eventsAfter = Number(row?.events_after ?? 0);
  const uptimeFailuresBefore = Number(row?.uptime_failures_before ?? 0);
  const uptimeFailuresAfter = Number(row?.uptime_failures_after ?? 0);

  const sessionsPct = pctChange(sessionsAfter, sessionsBefore);
  const pageviewsPct = pctChange(pageviewsAfter, pageviewsBefore);
  const eventsPct = pctChange(eventsAfter, eventsBefore);

  let conversionsBefore: number | null = null;
  let conversionsAfter: number | null = null;
  let conversionsPct: number | null = null;
  if (caps.eventsIsConversion) {
    const conversionRows = await pool.query<{ before: string; after: string }>(
      `SELECT
         (SELECT count(*)::text FROM events e WHERE e.website_id = $1::uuid AND e.occurred_at >= $2::timestamptz AND e.occurred_at < $3::timestamptz AND e.is_conversion = true) AS before,
         (SELECT count(*)::text FROM events e WHERE e.website_id = $1::uuid AND e.occurred_at >= $4::timestamptz AND e.occurred_at < $5::timestamptz AND e.is_conversion = true) AS after`,
      [
        change.website_id,
        beforeStart.toISOString(),
        beforeEnd.toISOString(),
        afterStart.toISOString(),
        afterEnd.toISOString(),
      ],
    );
    conversionsBefore = Number(conversionRows.rows[0]?.before ?? 0);
    conversionsAfter = Number(conversionRows.rows[0]?.after ?? 0);
    conversionsPct = pctChange(conversionsAfter, conversionsBefore);
  }

  let riskBefore: number | null = null;
  let riskAfter: number | null = null;
  if (caps.sessionsRiskScore) {
    const riskRows = await pool.query<{ before: string; after: string }>(
      `SELECT
         (SELECT count(*)::text FROM sessions s WHERE s.website_id = $1::uuid AND s.started_at >= $2::timestamptz AND s.started_at < $3::timestamptz AND s.risk_score >= 0.8) AS before,
         (SELECT count(*)::text FROM sessions s WHERE s.website_id = $1::uuid AND s.started_at >= $4::timestamptz AND s.started_at < $5::timestamptz AND s.risk_score >= 0.8) AS after`,
      [
        change.website_id,
        beforeStart.toISOString(),
        beforeEnd.toISOString(),
        afterStart.toISOString(),
        afterEnd.toISOString(),
      ],
    );
    riskBefore = Number(riskRows.rows[0]?.before ?? 0);
    riskAfter = Number(riskRows.rows[0]?.after ?? 0);
  }

  const flags: string[] = [];
  if (Math.abs(pageviewsPct) >= IMPACT_RULES.significantChangePct) {
    flags.push(pageviewsPct > 0 ? "traffic_spike" : "traffic_drop");
  }
  if (uptimeFailuresAfter > uptimeFailuresBefore && uptimeFailuresAfter > 0) {
    flags.push("uptime_impact");
  }
  if (
    conversionsBefore != null &&
    conversionsAfter != null &&
    conversionsPct != null &&
    Math.abs(conversionsPct) >= IMPACT_RULES.significantChangePct
  ) {
    flags.push("conversion_change");
  }
  if (
    riskBefore != null &&
    riskAfter != null &&
    riskAfter > riskBefore
  ) {
    flags.push("risk_change");
  }

  const notable = [
    ...compareTopDiffs(topPagesBefore, topPagesAfter, "page"),
    ...compareTopDiffs(topEventsBefore, topEventsAfter, "event"),
  ];

  let summary = `This change aligns with pageview movement of ${fmtPct(pageviewsPct)} in the following 24h window.`;
  if (flags.includes("uptime_impact")) {
    summary = "This change window aligns with increased uptime failures.";
  } else if (flags.includes("risk_change")) {
    summary = "This change window aligns with an increase in high-risk sessions.";
  } else if (flags.includes("traffic_drop")) {
    summary = "This change window aligns with a notable traffic drop.";
  } else if (flags.includes("traffic_spike")) {
    summary = "This change window aligns with a notable traffic increase.";
  }

  return {
    change_log_id: change.id,
    website_id: change.website_id,
    title: change.title,
    change_type: change.change_type,
    created_at: change.created_at.toISOString(),
    summary,
    metrics: {
      sessions_before: sessionsBefore,
      sessions_after: sessionsAfter,
      sessions_percent_change: Number(sessionsPct.toFixed(2)),
      pageviews_before: pageviewsBefore,
      pageviews_after: pageviewsAfter,
      pageviews_percent_change: Number(pageviewsPct.toFixed(2)),
      events_before: eventsBefore,
      events_after: eventsAfter,
      events_percent_change: Number(eventsPct.toFixed(2)),
      conversions_before: conversionsBefore,
      conversions_after: conversionsAfter,
      conversions_percent_change: conversionsPct != null ? Number(conversionsPct.toFixed(2)) : null,
      uptime_failures_before: uptimeFailuresBefore,
      uptime_failures_after: uptimeFailuresAfter,
      risk_sessions_before: riskBefore,
      risk_sessions_after: riskAfter,
    },
    flags,
    notable_differences: notable.slice(0, 4),
  };
}

export async function getChangeLogImpact(
  changeLogId: string,
): Promise<ChangeImpactResult | null> {
  const change = await getChangeLogById(changeLogId);
  if (!change) return null;
  return computeImpactForChange(change);
}

export async function getWebsiteChangeImpacts(
  websiteId: string,
): Promise<ChangeImpactResult[]> {
  const changes = await listChangeLogsForWebsite(websiteId, IMPACT_RULES.recentChangesLimit);
  const impacts = await Promise.all(changes.map((change) => computeImpactForChange(change)));
  return impacts;
}

export { IMPACT_RULES };
