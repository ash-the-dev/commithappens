import "server-only";
import { getPool } from "@/lib/db/pool";
import { explainWebsiteSpike, type WebsiteAnomaly } from "@/lib/db/insights";
import { listChangeLogsForWebsite } from "@/lib/db/change-logs";
import type { SpikeExplanationInput } from "@/lib/ai/types";

type SpikeCaps = {
  eventsIsConversion: boolean;
  sessionsRiskScore: boolean;
};

let spikeCapsCache: SpikeCaps | null = null;

function pctChange(current: number, baseline: number): number {
  if (baseline === 0) return current === 0 ? 0 : 100;
  return ((current - baseline) / baseline) * 100;
}

function isoDayDate(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00.000Z`);
}

async function getSpikeCaps(): Promise<SpikeCaps> {
  if (spikeCapsCache) return spikeCapsCache;
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
  spikeCapsCache = {
    eventsIsConversion: has("events", "is_conversion"),
    sessionsRiskScore: has("sessions", "risk_score"),
  };
  return spikeCapsCache;
}

async function getWebsiteName(websiteId: string): Promise<string> {
  const pool = getPool();
  const result = await pool.query<{ name: string }>(
    `SELECT name FROM websites WHERE id = $1::uuid LIMIT 1`,
    [websiteId],
  );
  return result.rows[0]?.name ?? "Website";
}

export async function buildSpikeExplanationInput(
  websiteId: string,
  targetDate: string,
  anomaly?: WebsiteAnomaly,
): Promise<SpikeExplanationInput> {
  const pool = getPool();
  const caps = await getSpikeCaps();
  const websiteName = await getWebsiteName(websiteId);

  const targetStart = isoDayDate(targetDate);
  const targetEnd = new Date(targetStart);
  targetEnd.setUTCDate(targetEnd.getUTCDate() + 1);
  const baselineStart = new Date(targetStart);
  baselineStart.setUTCDate(baselineStart.getUTCDate() - 7);
  const baselineEnd = new Date(targetStart);

  const [metricsRes, topPagesTarget, topPagesBaseline, topEventsTarget, topEventsBaseline, uptimeRes, riskRes, changes, deterministic] =
    await Promise.all([
      pool.query<{
        sessions_target: string;
        sessions_baseline: string;
        pageviews_target: string;
        pageviews_baseline: string;
        events_target: string;
        events_baseline: string;
        conversions_target?: string;
        conversions_baseline?: string;
      }>(
        `SELECT
          (SELECT count(*)::text FROM sessions s WHERE s.website_id = $1::uuid AND s.started_at >= $2::timestamptz AND s.started_at < $3::timestamptz) AS sessions_target,
          (SELECT count(*)::text FROM sessions s WHERE s.website_id = $1::uuid AND s.started_at >= $4::timestamptz AND s.started_at < $5::timestamptz)::text AS sessions_baseline,
          (SELECT count(*)::text FROM pageviews p WHERE p.website_id = $1::uuid AND p.occurred_at >= $2::timestamptz AND p.occurred_at < $3::timestamptz) AS pageviews_target,
          (SELECT count(*)::text FROM pageviews p WHERE p.website_id = $1::uuid AND p.occurred_at >= $4::timestamptz AND p.occurred_at < $5::timestamptz)::text AS pageviews_baseline,
          (SELECT count(*)::text FROM events e WHERE e.website_id = $1::uuid AND e.occurred_at >= $2::timestamptz AND e.occurred_at < $3::timestamptz) AS events_target,
          (SELECT count(*)::text FROM events e WHERE e.website_id = $1::uuid AND e.occurred_at >= $4::timestamptz AND e.occurred_at < $5::timestamptz)::text AS events_baseline
        `,
        [
          websiteId,
          targetStart.toISOString(),
          targetEnd.toISOString(),
          baselineStart.toISOString(),
          baselineEnd.toISOString(),
        ],
      ),
      pool.query<{ path: string; count: string }>(
        `SELECT path, count(*)::text AS count
         FROM pageviews
         WHERE website_id = $1::uuid
           AND occurred_at >= $2::timestamptz
           AND occurred_at < $3::timestamptz
         GROUP BY path
         ORDER BY count DESC
         LIMIT 8`,
        [websiteId, targetStart.toISOString(), targetEnd.toISOString()],
      ),
      pool.query<{ path: string; count: string }>(
        `SELECT path, count(*)::text AS count
         FROM pageviews
         WHERE website_id = $1::uuid
           AND occurred_at >= $2::timestamptz
           AND occurred_at < $3::timestamptz
         GROUP BY path
         ORDER BY count DESC
         LIMIT 20`,
        [websiteId, baselineStart.toISOString(), baselineEnd.toISOString()],
      ),
      pool.query<{ name: string; count: string }>(
        `SELECT name, count(*)::text AS count
         FROM events
         WHERE website_id = $1::uuid
           AND occurred_at >= $2::timestamptz
           AND occurred_at < $3::timestamptz
         GROUP BY name
         ORDER BY count DESC
         LIMIT 8`,
        [websiteId, targetStart.toISOString(), targetEnd.toISOString()],
      ),
      pool.query<{ name: string; count: string }>(
        `SELECT name, count(*)::text AS count
         FROM events
         WHERE website_id = $1::uuid
           AND occurred_at >= $2::timestamptz
           AND occurred_at < $3::timestamptz
         GROUP BY name
         ORDER BY count DESC
         LIMIT 20`,
        [websiteId, baselineStart.toISOString(), baselineEnd.toISOString()],
      ),
      pool.query<{ failures_target: string; failures_baseline: string }>(
        `SELECT
           (SELECT count(*)::text FROM uptime_checks u WHERE u.site_id = $1::uuid AND u.checked_at >= $2::timestamptz AND u.checked_at < $3::timestamptz AND u.is_up = false) AS failures_target,
           (SELECT count(*)::text FROM uptime_checks u WHERE u.site_id = $1::uuid AND u.checked_at >= $4::timestamptz AND u.checked_at < $5::timestamptz AND u.is_up = false) AS failures_baseline`,
        [
          websiteId,
          targetStart.toISOString(),
          targetEnd.toISOString(),
          baselineStart.toISOString(),
          baselineEnd.toISOString(),
        ],
      ),
      caps.sessionsRiskScore
        ? pool.query<{ risk_target: string; risk_baseline: string }>(
            `SELECT
               (SELECT count(*)::text FROM sessions s WHERE s.website_id = $1::uuid AND s.started_at >= $2::timestamptz AND s.started_at < $3::timestamptz AND s.risk_score >= 0.8) AS risk_target,
               (SELECT count(*)::text FROM sessions s WHERE s.website_id = $1::uuid AND s.started_at >= $4::timestamptz AND s.started_at < $5::timestamptz AND s.risk_score >= 0.8) AS risk_baseline`,
            [
              websiteId,
              targetStart.toISOString(),
              targetEnd.toISOString(),
              baselineStart.toISOString(),
              baselineEnd.toISOString(),
            ],
          )
        : Promise.resolve({ rows: [{ risk_target: "0", risk_baseline: "0" }] }),
      listChangeLogsForWebsite(websiteId, 20),
      explainWebsiteSpike(websiteId, targetDate),
    ]);

  let conversionsTarget: number | null = null;
  let conversionsBaseline: number | null = null;
  if (caps.eventsIsConversion) {
    const convRes = await pool.query<{ target: string; baseline: string }>(
      `SELECT
         (SELECT count(*)::text FROM events e WHERE e.website_id = $1::uuid AND e.occurred_at >= $2::timestamptz AND e.occurred_at < $3::timestamptz AND e.is_conversion = true) AS target,
         (SELECT count(*)::text FROM events e WHERE e.website_id = $1::uuid AND e.occurred_at >= $4::timestamptz AND e.occurred_at < $5::timestamptz AND e.is_conversion = true) AS baseline`,
      [
        websiteId,
        targetStart.toISOString(),
        targetEnd.toISOString(),
        baselineStart.toISOString(),
        baselineEnd.toISOString(),
      ],
    );
    conversionsTarget = Number(convRes.rows[0]?.target ?? 0);
    conversionsBaseline = Number(convRes.rows[0]?.baseline ?? 0) / 7;
  }

  const sessionsTarget = Number(metricsRes.rows[0]?.sessions_target ?? 0);
  const sessionsBaseline = Number(metricsRes.rows[0]?.sessions_baseline ?? 0) / 7;
  const pageviewsTarget = Number(metricsRes.rows[0]?.pageviews_target ?? 0);
  const pageviewsBaseline = Number(metricsRes.rows[0]?.pageviews_baseline ?? 0) / 7;
  const eventsTarget = Number(metricsRes.rows[0]?.events_target ?? 0);
  const eventsBaseline = Number(metricsRes.rows[0]?.events_baseline ?? 0) / 7;

  const baselinePageMap = new Map(
    topPagesBaseline.rows.map((r) => [r.path, Number(r.count) / 7]),
  );
  const topPageDeltas = topPagesTarget.rows
    .map((r) => {
      const current = Number(r.count);
      const baseline = baselinePageMap.get(r.path) ?? 0;
      return {
        path: r.path,
        current,
        baseline: Number(baseline.toFixed(2)),
        percent_change: Number(pctChange(current, baseline).toFixed(2)),
      };
    })
    .sort((a, b) => Math.abs(b.percent_change) - Math.abs(a.percent_change))
    .slice(0, 4);

  const baselineEventMap = new Map(
    topEventsBaseline.rows.map((r) => [r.name, Number(r.count) / 7]),
  );
  const topEventDeltas = topEventsTarget.rows
    .map((r) => {
      const current = Number(r.count);
      const baseline = baselineEventMap.get(r.name) ?? 0;
      return {
        event_name: r.name,
        current,
        baseline: Number(baseline.toFixed(2)),
        percent_change: Number(pctChange(current, baseline).toFixed(2)),
      };
    })
    .sort((a, b) => Math.abs(b.percent_change) - Math.abs(a.percent_change))
    .slice(0, 4);

  const targetDayStartMs = targetStart.getTime();
  const targetDayEndMs = targetEnd.getTime();
  const nearChanges = changes
    .filter((c) => {
      const t = c.created_at.getTime();
      return t >= targetDayStartMs - 12 * 60 * 60 * 1000 && t < targetDayEndMs;
    })
    .slice(0, 3);

  const uptimeFailuresTarget = Number(uptimeRes.rows[0]?.failures_target ?? 0);
  const uptimeFailuresBaseline = Number(uptimeRes.rows[0]?.failures_baseline ?? 0) / 7;
  const riskTarget = Number(riskRes.rows[0]?.risk_target ?? 0);
  const riskBaseline = Number(riskRes.rows[0]?.risk_baseline ?? 0) / 7;

  const uptimeSignals: string[] = [];
  if (uptimeFailuresTarget > 0) {
    uptimeSignals.push(`${uptimeFailuresTarget} uptime failure(s) occurred on the target day.`);
  }
  if (uptimeFailuresTarget > uptimeFailuresBaseline) {
    uptimeSignals.push("Uptime failures were higher than the baseline window.");
  }

  const threatSignals: string[] = [];
  if (caps.sessionsRiskScore) {
    if (riskTarget > 0) {
      threatSignals.push(`${riskTarget} high-risk session(s) detected on target day.`);
    }
    if (riskTarget > riskBaseline) {
      threatSignals.push("High-risk session volume rose versus baseline.");
    }
  }

  const changeSignals = nearChanges.map(
    (c) => `Change "${c.title}" recorded at ${c.created_at.toISOString()}.`,
  );

  const sourceSignals = deterministic.factors
    .filter((f) => f.type === "source")
    .map((f) => f.description)
    .slice(0, 2);

  const strongestFactors = [
    ...topPageDeltas.slice(0, 2).map((p) => `Page shift: ${p.path} (${p.percent_change.toFixed(1)}%).`),
    ...topEventDeltas.slice(0, 2).map((e) => `Event shift: ${e.event_name} (${e.percent_change.toFixed(1)}%).`),
    ...uptimeSignals.slice(0, 1),
    ...threatSignals.slice(0, 1),
  ].slice(0, 5);

  return {
    website_name: websiteName,
    target_date: targetDate,
    anomaly_type: anomaly?.anomaly_type ?? "spike",
    metric_focus: anomaly?.metric_type ?? "pageviews",
    current_metrics: {
      sessions: sessionsTarget,
      pageviews: pageviewsTarget,
      events: eventsTarget,
      conversions: conversionsTarget,
    },
    baseline_metrics: {
      sessions: Number(sessionsBaseline.toFixed(2)),
      pageviews: Number(pageviewsBaseline.toFixed(2)),
      events: Number(eventsBaseline.toFixed(2)),
      conversions: conversionsBaseline != null ? Number(conversionsBaseline.toFixed(2)) : null,
    },
    metric_deltas: {
      sessions_pct: Number(pctChange(sessionsTarget, sessionsBaseline).toFixed(2)),
      pageviews_pct: Number(pctChange(pageviewsTarget, pageviewsBaseline).toFixed(2)),
      events_pct: Number(pctChange(eventsTarget, eventsBaseline).toFixed(2)),
      conversions_pct:
        conversionsTarget != null && conversionsBaseline != null
          ? Number(pctChange(conversionsTarget, conversionsBaseline).toFixed(2))
          : null,
    },
    top_page_deltas: topPageDeltas,
    top_event_deltas: topEventDeltas,
    uptime_signals: uptimeSignals,
    threat_signals: threatSignals,
    change_signals: changeSignals,
    source_signals: sourceSignals,
    strongest_factors: strongestFactors,
  };
}
