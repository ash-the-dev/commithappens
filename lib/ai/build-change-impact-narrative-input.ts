import "server-only";
import { getPool } from "@/lib/db/pool";
import { IMPACT_RULES, getChangeLogImpact } from "@/lib/db/change-impact";
import { getChangeLogById } from "@/lib/db/change-logs";
import { detectWebsiteAnomalies } from "@/lib/db/insights";
import type { ChangeImpactNarrativeInput } from "@/lib/ai/types";

function toDate(iso: string): Date {
  return new Date(iso);
}

function buildWindows(changeCreatedAtIso: string, hours: number) {
  const created = toDate(changeCreatedAtIso);
  const postStart = new Date(created);
  const postEnd = new Date(created);
  postEnd.setHours(postEnd.getHours() + hours);
  const baselineEnd = new Date(created);
  const baselineStart = new Date(created);
  baselineStart.setHours(baselineStart.getHours() - hours);
  return { baselineStart, baselineEnd, postStart, postEnd };
}

function classifyMetricDirection(
  sessionsPct: number,
  pageviewsPct: number,
  eventsPct: number,
): "positive" | "negative" | "mixed" | "neutral" {
  const upCount = [sessionsPct, pageviewsPct, eventsPct].filter((v) => v >= 20).length;
  const downCount = [sessionsPct, pageviewsPct, eventsPct].filter((v) => v <= -20).length;
  if (upCount >= 2) return "positive";
  if (downCount >= 2) return "negative";
  if (upCount >= 1 && downCount >= 1) return "mixed";
  return "neutral";
}

export async function buildChangeImpactNarrativeInput(
  changeLogId: string,
): Promise<ChangeImpactNarrativeInput | null> {
  const [change, impact] = await Promise.all([
    getChangeLogById(changeLogId),
    getChangeLogImpact(changeLogId),
  ]);
  if (!change || !impact) return null;

  const pool = getPool();
  const websiteNameRes = await pool.query<{ name: string }>(
    `SELECT name FROM websites WHERE id = $1::uuid LIMIT 1`,
    [change.website_id],
  );
  const websiteName = websiteNameRes.rows[0]?.name ?? "Website";

  const windows = buildWindows(change.created_at.toISOString(), IMPACT_RULES.defaultWindowHours);

  const [anomalies, riskRows] = await Promise.all([
    detectWebsiteAnomalies(change.website_id),
    pool
      .query<{ before: string; after: string }>(
        `SELECT
           (SELECT count(*)::text FROM sessions s
             WHERE s.website_id = $1::uuid
               AND s.started_at >= $2::timestamptz
               AND s.started_at < $3::timestamptz
               AND s.risk_score >= 0.8) AS before,
           (SELECT count(*)::text FROM sessions s
             WHERE s.website_id = $1::uuid
               AND s.started_at >= $4::timestamptz
               AND s.started_at < $5::timestamptz
               AND s.risk_score >= 0.8) AS after`,
        [
          change.website_id,
          windows.baselineStart.toISOString(),
          windows.baselineEnd.toISOString(),
          windows.postStart.toISOString(),
          windows.postEnd.toISOString(),
        ],
      )
      .catch(() => ({ rows: [{ before: "0", after: "0" }] })),
  ]);

  const anomalySignals = anomalies
    .filter((a) => {
      const dayStart = new Date(`${a.date}T00:00:00.000Z`).getTime();
      return (
        dayStart >= windows.postStart.getTime() - 24 * 60 * 60 * 1000 &&
        dayStart <= windows.postEnd.getTime()
      );
    })
    .slice(0, 3)
    .map(
      (a) =>
        `Anomaly ${a.anomaly_type}: ${a.metric_type} ${a.percent_change.toFixed(
          1,
        )}% around ${a.date}.`,
    );

  const threatBefore = Number(riskRows.rows[0]?.before ?? 0);
  const threatAfter = Number(riskRows.rows[0]?.after ?? 0);
  const threatSignals: string[] = [];
  if (threatAfter > 0) {
    threatSignals.push(`${threatAfter} high-risk session(s) in post-change window.`);
  }
  if (threatAfter > threatBefore) {
    threatSignals.push("High-risk sessions increased versus baseline window.");
  }

  return {
    website_name: websiteName,
    change_log: {
      id: change.id,
      title: change.title,
      description: change.description,
      change_type: change.change_type,
      created_at: change.created_at.toISOString(),
      source: change.source,
      metadata: change.metadata ?? {},
    },
    impact_window: {
      baseline_start: windows.baselineStart.toISOString(),
      baseline_end: windows.baselineEnd.toISOString(),
      post_start: windows.postStart.toISOString(),
      post_end: windows.postEnd.toISOString(),
      window_hours: IMPACT_RULES.defaultWindowHours,
    },
    metric_deltas: impact.metrics,
    top_page_deltas: impact.notable_differences.filter((line) => line.startsWith("Page ")),
    top_event_deltas: impact.notable_differences.filter((line) => line.startsWith("Event ")),
    uptime_signals: impact.flags.includes("uptime_impact")
      ? ["Uptime failures were higher in the post-change window."]
      : [],
    threat_signals: threatSignals,
    anomaly_signals: anomalySignals,
    strongest_factors: [
      ...impact.notable_differences.slice(0, 3),
      ...threatSignals.slice(0, 1),
    ].slice(0, 5),
    impact_flags: [
      ...impact.flags,
      classifyMetricDirection(
        impact.metrics.sessions_percent_change,
        impact.metrics.pageviews_percent_change,
        impact.metrics.events_percent_change,
      ),
    ],
  };
}
