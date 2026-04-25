import { getPool } from "@/lib/db/pool";
import { getSiteAnalytics } from "@/lib/db/analytics";
import type { WebsiteThreatOverview } from "@/lib/db/threats";
import { getWebsiteThreatOverview } from "@/lib/db/threats";

type OptionalColumnCaps = {
  eventsIsConversion: boolean;
};

let optionalCapsCache: OptionalColumnCaps | null = null;

const INSIGHT_THRESHOLDS = {
  significantChangePct: 25,
  lowSessions24h: 5,
  lowPageviews24h: 10,
  dominantPageShare: 0.5,
  lcpWarnMs: 2500,
  clsWarn: 0.1,
  inpWarnMs: 200,
  anomalyBaselineDays: 7,
  anomalyMinBaseline: 3,
  anomalyDeltaPct: 40,
} as const;

export type WebsiteAnomaly = {
  date: string;
  metric_type: "sessions" | "pageviews" | "events";
  actual_value: number;
  baseline_value: number;
  percent_change: number;
  anomaly_type: "spike" | "drop";
  confidence_label?: "medium" | "high";
};

export type SpikeFactor = {
  type: "page" | "event" | "source" | "uptime" | "conversion" | "traffic";
  label: string;
  description: string;
  metric_value: number | null;
  baseline_value: number | null;
  percent_change: number | null;
};

export type WebsiteSpikeExplanation = {
  summary: string;
  factors: SpikeFactor[];
  target_date: string;
  compared_range: string;
};

export type WebsiteInsights = {
  summary_text: string;
  key_points: string[];
  detected_flags: string[];
  generated_at: string;
  supporting_metrics: Record<string, number | string | boolean | null>;
  anomalies: WebsiteAnomaly[];
  latest_anomaly: WebsiteAnomaly | null;
  latest_spike_explanation: WebsiteSpikeExplanation | null;
};

function pctChange(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return ((current - previous) / previous) * 100;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseIsoDay(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00.000Z`);
}

function fmtPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function findMetricAverage(
  vitalAverages: Array<{ metric: string; average: number }>,
  metric: string,
): number | null {
  const match = vitalAverages.find((v) => v.metric.toUpperCase() === metric);
  return match ? match.average : null;
}

async function getOptionalColumnCaps(): Promise<OptionalColumnCaps> {
  if (optionalCapsCache) return optionalCapsCache;
  const pool = getPool();
  const result = await pool.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('events')`,
  );
  const has = (table: string, col: string) =>
    result.rows.some((r) => r.table_name === table && r.column_name === col);
  optionalCapsCache = {
    eventsIsConversion: has("events", "is_conversion"),
  };
  return optionalCapsCache;
}

export async function detectWebsiteAnomalies(
  websiteId: string,
): Promise<WebsiteAnomaly[]> {
  const analytics = await getSiteAnalytics(websiteId);
  const series = analytics.timeline;
  const baselineDays = INSIGHT_THRESHOLDS.anomalyBaselineDays;
  const minBaseline = INSIGHT_THRESHOLDS.anomalyMinBaseline;
  const deltaThreshold = INSIGHT_THRESHOLDS.anomalyDeltaPct;
  const anomalies: WebsiteAnomaly[] = [];

  for (let idx = baselineDays; idx < series.length; idx += 1) {
    const current = series[idx];
    const previous = series.slice(idx - baselineDays, idx);

    const metrics: Array<"sessions" | "pageviews" | "events"> = [
      "sessions",
      "pageviews",
      "events",
    ];
    for (const metric of metrics) {
      const baseline = avg(previous.map((d) => d[metric]));
      if (baseline < minBaseline) continue;
      const actual = current[metric];
      const delta = pctChange(actual, baseline);
      if (Math.abs(delta) < deltaThreshold) continue;
      anomalies.push({
        date: current.day,
        metric_type: metric,
        actual_value: actual,
        baseline_value: Number(baseline.toFixed(2)),
        percent_change: Number(delta.toFixed(2)),
        anomaly_type: delta > 0 ? "spike" : "drop",
        confidence_label: Math.abs(delta) > 100 ? "high" : "medium",
      });
    }
  }

  anomalies.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return Math.abs(b.percent_change) - Math.abs(a.percent_change);
  });
  return anomalies;
}

export async function explainWebsiteSpike(
  websiteId: string,
  targetDate: string,
): Promise<WebsiteSpikeExplanation> {
  const pool = getPool();
  const target = parseIsoDay(targetDate);
  const next = new Date(target);
  next.setUTCDate(next.getUTCDate() + 1);
  const baselineStart = new Date(target);
  baselineStart.setUTCDate(baselineStart.getUTCDate() - 7);
  const baselineEnd = new Date(target);

  const [traffic, targetPages, baselinePages, targetEvents, baselineEvents, sources, uptime] =
    await Promise.all([
      pool.query<{
        sessions_target: string;
        sessions_baseline_total: string;
        pageviews_target: string;
        pageviews_baseline_total: string;
        events_target: string;
        events_baseline_total: string;
      }>(
        `SELECT
           (SELECT count(*)::text FROM sessions s WHERE s.website_id = $1 AND s.started_at >= $2::timestamptz AND s.started_at < $3::timestamptz) AS sessions_target,
           (SELECT count(*)::text FROM sessions s WHERE s.website_id = $1 AND s.started_at >= $4::timestamptz AND s.started_at < $2::timestamptz) AS sessions_baseline_total,
           (SELECT count(*)::text FROM pageviews p WHERE p.website_id = $1 AND p.occurred_at >= $2::timestamptz AND p.occurred_at < $3::timestamptz) AS pageviews_target,
           (SELECT count(*)::text FROM pageviews p WHERE p.website_id = $1 AND p.occurred_at >= $4::timestamptz AND p.occurred_at < $2::timestamptz) AS pageviews_baseline_total,
           (SELECT count(*)::text FROM events e WHERE e.website_id = $1 AND e.occurred_at >= $2::timestamptz AND e.occurred_at < $3::timestamptz) AS events_target,
           (SELECT count(*)::text FROM events e WHERE e.website_id = $1 AND e.occurred_at >= $4::timestamptz AND e.occurred_at < $2::timestamptz) AS events_baseline_total`,
        [
          websiteId,
          target.toISOString(),
          next.toISOString(),
          baselineStart.toISOString(),
        ],
      ),
      pool.query<{ path: string; views: string }>(
        `SELECT path, count(*)::text AS views
         FROM pageviews
         WHERE website_id = $1
           AND occurred_at >= $2::timestamptz
           AND occurred_at < $3::timestamptz
         GROUP BY path
         ORDER BY views DESC
         LIMIT 5`,
        [websiteId, target.toISOString(), next.toISOString()],
      ),
      pool.query<{ path: string; views: string }>(
        `SELECT path, count(*)::text AS views
         FROM pageviews
         WHERE website_id = $1
           AND occurred_at >= $2::timestamptz
           AND occurred_at < $3::timestamptz
         GROUP BY path
         ORDER BY views DESC
         LIMIT 20`,
        [websiteId, baselineStart.toISOString(), baselineEnd.toISOString()],
      ),
      pool.query<{ name: string; count: string }>(
        `SELECT name, count(*)::text AS count
         FROM events
         WHERE website_id = $1
           AND occurred_at >= $2::timestamptz
           AND occurred_at < $3::timestamptz
         GROUP BY name
         ORDER BY count DESC
         LIMIT 5`,
        [websiteId, target.toISOString(), next.toISOString()],
      ),
      pool.query<{ name: string; count: string }>(
        `SELECT name, count(*)::text AS count
         FROM events
         WHERE website_id = $1
           AND occurred_at >= $2::timestamptz
           AND occurred_at < $3::timestamptz
         GROUP BY name
         ORDER BY count DESC
         LIMIT 20`,
        [websiteId, baselineStart.toISOString(), baselineEnd.toISOString()],
      ),
      pool.query<{ channel: string; sessions: string }>(
        `SELECT coalesce(ts.channel, 'unknown') AS channel, count(*)::text AS sessions
         FROM sessions s
         LEFT JOIN traffic_sources ts ON ts.id = s.traffic_source_id
         WHERE s.website_id = $1
           AND s.started_at >= $2::timestamptz
           AND s.started_at < $3::timestamptz
         GROUP BY 1
         ORDER BY sessions DESC
         LIMIT 6`,
        [websiteId, target.toISOString(), next.toISOString()],
      ),
      pool.query<{ checks: string; failed: string }>(
        `SELECT
           count(*)::text AS checks,
           count(*) FILTER (WHERE is_up = false)::text AS failed
        FROM uptime_checks
        WHERE site_id = $1
           AND checked_at >= $2::timestamptz
           AND checked_at < $3::timestamptz`,
        [websiteId, target.toISOString(), next.toISOString()],
      ),
    ]);

  const factors: SpikeFactor[] = [];
  const trafficRow = traffic.rows[0];
  const baselineDivisor = 7;
  const sessionTarget = Number(trafficRow?.sessions_target ?? 0);
  const sessionBaseline = Number(trafficRow?.sessions_baseline_total ?? 0) / baselineDivisor;
  const pageTarget = Number(trafficRow?.pageviews_target ?? 0);
  const pageBaseline = Number(trafficRow?.pageviews_baseline_total ?? 0) / baselineDivisor;
  const eventTarget = Number(trafficRow?.events_target ?? 0);
  const eventBaseline = Number(trafficRow?.events_baseline_total ?? 0) / baselineDivisor;

  if (sessionTarget > 0 || sessionBaseline > 0) {
    factors.push({
      type: "traffic",
      label: "Sessions",
      description: `Sessions were ${sessionTarget} vs ${sessionBaseline.toFixed(1)} baseline/day (${fmtPct(
        pctChange(sessionTarget, sessionBaseline),
      )}).`,
      metric_value: sessionTarget,
      baseline_value: Number(sessionBaseline.toFixed(1)),
      percent_change: Number(pctChange(sessionTarget, sessionBaseline).toFixed(2)),
    });
  }
  if (pageTarget > 0 || pageBaseline > 0) {
    factors.push({
      type: "traffic",
      label: "Pageviews",
      description: `Pageviews were ${pageTarget} vs ${pageBaseline.toFixed(1)} baseline/day (${fmtPct(
        pctChange(pageTarget, pageBaseline),
      )}).`,
      metric_value: pageTarget,
      baseline_value: Number(pageBaseline.toFixed(1)),
      percent_change: Number(pctChange(pageTarget, pageBaseline).toFixed(2)),
    });
  }

  const baselinePageMap = new Map<string, number>();
  for (const row of baselinePages.rows) {
    baselinePageMap.set(row.path, Number(row.views) / baselineDivisor);
  }
  const topPage = targetPages.rows[0];
  if (topPage) {
    const pageValue = Number(topPage.views);
    const pageBaselineValue = baselinePageMap.get(topPage.path) ?? 0;
    factors.push({
      type: "page",
      label: topPage.path,
      description: `${topPage.path} had ${pageValue} views vs ${pageBaselineValue.toFixed(
        1,
      )} baseline/day (${fmtPct(pctChange(pageValue, pageBaselineValue))}).`,
      metric_value: pageValue,
      baseline_value: Number(pageBaselineValue.toFixed(1)),
      percent_change: Number(pctChange(pageValue, pageBaselineValue).toFixed(2)),
    });
  }

  const baselineEventMap = new Map<string, number>();
  for (const row of baselineEvents.rows) {
    baselineEventMap.set(row.name, Number(row.count) / baselineDivisor);
  }
  const topEvent = targetEvents.rows[0];
  if (topEvent) {
    const eventValue = Number(topEvent.count);
    const eventBaselineValue = baselineEventMap.get(topEvent.name) ?? 0;
    factors.push({
      type: "event",
      label: topEvent.name,
      description: `Event "${topEvent.name}" fired ${eventValue} times vs ${eventBaselineValue.toFixed(
        1,
      )} baseline/day (${fmtPct(pctChange(eventValue, eventBaselineValue))}).`,
      metric_value: eventValue,
      baseline_value: Number(eventBaselineValue.toFixed(1)),
      percent_change: Number(pctChange(eventValue, eventBaselineValue).toFixed(2)),
    });
  }

  const topSource = sources.rows[0];
  if (topSource) {
    factors.push({
      type: "source",
      label: topSource.channel,
      description: `Top traffic source channel was ${topSource.channel} with ${topSource.sessions} sessions.`,
      metric_value: Number(topSource.sessions),
      baseline_value: null,
      percent_change: null,
    });
  }

  const up = uptime.rows[0];
  if (up && Number(up.failed) > 0) {
    factors.push({
      type: "uptime",
      label: "Downtime detected",
      description: `${up.failed} of ${up.checks} uptime checks failed on this day.`,
      metric_value: Number(up.failed),
      baseline_value: Number(up.checks),
      percent_change: null,
    });
  }

  if (eventTarget > 0 || eventBaseline > 0) {
    factors.push({
      type: "traffic",
      label: "Events",
      description: `Events were ${eventTarget} vs ${eventBaseline.toFixed(1)} baseline/day (${fmtPct(
        pctChange(eventTarget, eventBaseline),
      )}).`,
      metric_value: eventTarget,
      baseline_value: Number(eventBaseline.toFixed(1)),
      percent_change: Number(pctChange(eventTarget, eventBaseline).toFixed(2)),
    });
  }

  factors.sort((a, b) => {
    const aScore = Math.abs(a.percent_change ?? 0);
    const bScore = Math.abs(b.percent_change ?? 0);
    return bScore - aScore;
  });

  const summary =
    factors[0]?.description ??
    "No strong contributing factors were found for this date.";

  return {
    summary,
    factors: factors.slice(0, 6),
    target_date: targetDate,
    compared_range: `${toIsoDay(baselineStart)} to ${toIsoDay(baselineEnd)}`,
  };
}

export async function getWebsiteInsights(
  websiteId: string,
  threatOverview?: WebsiteThreatOverview,
): Promise<WebsiteInsights> {
  const [analytics, anomalies, optionalCaps, threat] = await Promise.all([
    getSiteAnalytics(websiteId),
    detectWebsiteAnomalies(websiteId),
    getOptionalColumnCaps(),
    threatOverview ? Promise.resolve(threatOverview) : getWebsiteThreatOverview(websiteId),
  ]);

  const flags: string[] = [];
  const points: string[] = [];
  const metrics = analytics.overview;
  const hasNoActivity =
    metrics.sessions24h === 0 && metrics.pageviews24h === 0 && metrics.events24h === 0;
  if (hasNoActivity) {
    flags.push("no_recent_activity");
    points.push("No sessions, pageviews, or events were recorded in the last 24 hours.");
  } else if (
    metrics.sessions24h <= INSIGHT_THRESHOLDS.lowSessions24h &&
    metrics.pageviews24h <= INSIGHT_THRESHOLDS.lowPageviews24h
  ) {
    flags.push("low_activity");
    points.push("Recent activity is low; traffic volume is still building.");
  }

  const currentDay = analytics.timeline[analytics.timeline.length - 1];
  const previousDay = analytics.timeline[analytics.timeline.length - 2];
  if (currentDay && previousDay) {
    const sessionDelta = pctChange(currentDay.sessions, previousDay.sessions);
    const pageviewDelta = pctChange(currentDay.pageviews, previousDay.pageviews);
    if (Math.abs(sessionDelta) >= INSIGHT_THRESHOLDS.significantChangePct) {
      flags.push(sessionDelta > 0 ? "sessions_spike" : "sessions_drop");
      points.push(
        `Sessions ${sessionDelta > 0 ? "increased" : "decreased"} ${fmtPct(
          sessionDelta,
        )} versus the previous day.`,
      );
    }
    if (Math.abs(pageviewDelta) >= INSIGHT_THRESHOLDS.significantChangePct) {
      flags.push(pageviewDelta > 0 ? "pageviews_spike" : "pageviews_drop");
      points.push(
        `Pageviews ${pageviewDelta > 0 ? "increased" : "decreased"} ${fmtPct(
          pageviewDelta,
        )} versus the previous day.`,
      );
    }
  }

  if (!analytics.uptime.hasChecks24h) {
    flags.push("uptime_not_configured");
    points.push("No uptime checks were recorded in the last 24 hours.");
  } else if (analytics.uptime.uptimePct24h < 100) {
    flags.push("uptime_downtime");
    points.push(
      `Uptime dropped to ${analytics.uptime.uptimePct24h.toFixed(
        2,
      )}% in the last 24 hours.`,
    );
  }

  const lcpAvg = findMetricAverage(analytics.vitalAverages, "LCP");
  const clsAvg = findMetricAverage(analytics.vitalAverages, "CLS");
  const inpAvg = findMetricAverage(analytics.vitalAverages, "INP");
  if (analytics.vitalAverages.length === 0) {
    flags.push("no_vitals");
    points.push("No web vitals have been captured yet.");
  } else {
    if (lcpAvg != null && lcpAvg > INSIGHT_THRESHOLDS.lcpWarnMs) {
      flags.push("slow_lcp");
      points.push(`LCP average is ${Math.round(lcpAvg)}ms, above the 2500ms target.`);
    }
    if (clsAvg != null && clsAvg > INSIGHT_THRESHOLDS.clsWarn) {
      flags.push("high_cls");
      points.push(`CLS average is ${clsAvg.toFixed(3)}, above the 0.1 target.`);
    }
    if (inpAvg != null && inpAvg > INSIGHT_THRESHOLDS.inpWarnMs) {
      flags.push("high_inp");
      points.push(`INP average is ${Math.round(inpAvg)}ms, above the 200ms target.`);
    }
  }

  const totalTopPageViews = analytics.topPages.reduce((sum, p) => sum + p.views, 0);
  const leadPage = analytics.topPages[0];
  if (leadPage && totalTopPageViews > 0) {
    const share = leadPage.views / totalTopPageViews;
    if (share >= INSIGHT_THRESHOLDS.dominantPageShare) {
      flags.push("dominant_page");
      points.push(
        `${leadPage.path} accounts for ${(share * 100).toFixed(
          1,
        )}% of tracked top-page views.`,
      );
    }
  }

  if (optionalCaps.eventsIsConversion) {
    const pool = getPool();
    const conv = await pool.query<{ conversions_24h: string }>(
      `SELECT count(*)::text AS conversions_24h
       FROM events
       WHERE website_id = $1
         AND occurred_at >= now() - interval '24 hours'
         AND is_conversion = true`,
      [websiteId],
    );
    const conversions24h = Number(conv.rows[0]?.conversions_24h ?? 0);
    if (conversions24h > 0) {
      flags.push("conversions_detected");
      points.push(`${conversions24h} conversion event(s) were recorded in the last 24 hours.`);
    } else if (metrics.events24h > 0) {
      flags.push("no_conversions");
      points.push("Events are flowing, but no conversion events were marked in the last 24 hours.");
    }
  }

  if (threat.total_flagged_sessions > 0) {
    flags.push("threat_activity_detected");
    points.push(
      `${threat.total_flagged_sessions} suspicious session(s) detected in the recent threat window (${threat.high_risk_sessions} high risk).`,
    );
  } else {
    flags.push("no_threat_activity");
    points.push("No suspicious behavior was detected in the recent threat window.");
  }

  const latestAnomaly = anomalies[0] ?? null;
  let latestSpikeExplanation: WebsiteSpikeExplanation | null = null;
  if (latestAnomaly && latestAnomaly.anomaly_type === "spike") {
    latestSpikeExplanation = await explainWebsiteSpike(websiteId, latestAnomaly.date);
    points.push(
      `Latest spike on ${latestAnomaly.date}: ${latestAnomaly.metric_type} ${fmtPct(
        latestAnomaly.percent_change,
      )} vs baseline.`,
    );
    flags.push("latest_spike_detected");
  }

  let summaryText = "Not enough data yet to generate insights.";
  if (points.length > 0) {
    summaryText = points[0];
  } else if (!hasNoActivity) {
    summaryText = "Metrics are stable with no strong anomalies in the latest period.";
  }

  return {
    summary_text: summaryText,
    key_points: points.slice(0, 5),
    detected_flags: Array.from(new Set(flags)),
    generated_at: new Date().toISOString(),
    supporting_metrics: {
      sessions_24h: metrics.sessions24h,
      pageviews_24h: metrics.pageviews24h,
      events_24h: metrics.events24h,
      uptime_pct_24h: analytics.uptime.uptimePct24h,
      uptime_checks_24h: analytics.uptime.checks24h,
      top_page_path: leadPage?.path ?? null,
      top_page_views: leadPage?.views ?? null,
      anomalies_detected: anomalies.length,
    },
    anomalies,
    latest_anomaly: latestAnomaly,
    latest_spike_explanation: latestSpikeExplanation,
  };
}

/** When `accountKind === "free"`, full insight pipelines are skipped; cards still render. */
export function emptyWebsiteInsightsForFreePlan(): WebsiteInsights {
  return {
    summary_text:
      "Intelligence and anomaly insights are on paid plans. Upgrade to unlock the full story.",
    key_points: [],
    detected_flags: [],
    generated_at: new Date().toISOString(),
    supporting_metrics: {},
    anomalies: [],
    latest_anomaly: null,
    latest_spike_explanation: null,
  };
}
