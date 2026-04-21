import { getPool } from "@/lib/db/pool";

const THREAT_RULES = {
  lookbackHours: 24,
  maxSessionsEvaluated: 250,
  scoreRapidEventBurst: 30,
  scoreHighPageviewBurst: 25,
  scoreShortHighIntensity: 20,
  scoreRepeatedSameEvent: 20,
  scoreSuspiciousPathRepetition: 15,
  scoreBounceEventMismatch: 15,
  scoreNoReferrerHighIntensity: 10,
  scoreIngestRiskHint: 10,
  scoreAboveBaselineDensity: 15,
  rapidEventMinCount: 25,
  highPageviewMinCount: 30,
  shortHighIntensityDurationSec: 60,
  shortHighIntensityActions: 20,
  rapidSessionDurationSec: 120,
  densePageviewDurationSec: 180,
  repeatedSameEventMin: 10,
  repeatedSamePathMin: 12,
  bounceEventMismatchMinEvents: 5,
  noReferrerHighIntensityActions: 30,
  lowSeverityMin: 25,
  mediumSeverityMin: 50,
  highSeverityMin: 75,
  baselineDensityMultiplier: 3,
  baselineMinActions: 15,
} as const;

type ThreatColumnCaps = {
  sessionsPageviewCount: boolean;
  sessionsEventCount: boolean;
  sessionsDurationSeconds: boolean;
  sessionsIsBounce: boolean;
  sessionsRiskScore: boolean;
  sessionsMetadata: boolean;
};

let columnCapsCache: ThreatColumnCaps | null = null;

type SessionBase = {
  id: string;
  website_id: string;
  started_at: Date;
  last_activity_at: Date;
  entry_path: string | null;
  referrer_url: string | null;
  pageview_count?: number | null;
  event_count?: number | null;
  duration_seconds?: number | null;
  is_bounce?: boolean | null;
  risk_score?: number | null;
  metadata?: Record<string, unknown> | null;
};

type ThreatEvaluationInput = {
  session: SessionBase;
  eventCount: number;
  pageviewCount: number;
  durationSeconds: number;
  maxSameEventCount: number;
  maxSamePathCount: number;
  dominantEventName: string | null;
  suspiciousPath: string | null;
  avgActionsPerSession: number;
};

export type ThreatFlag = {
  session_id: string;
  website_id: string;
  severity: "low" | "medium" | "high";
  score: number;
  reason_codes: string[];
  summary: string;
  occurred_at: string;
  path?: string | null;
  event_name?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type WebsiteThreatOverview = {
  total_flagged_sessions: number;
  high_risk_sessions: number;
  medium_risk_sessions: number;
  low_risk_sessions: number;
  flagged_activity_count: number;
  recent_flags: ThreatFlag[];
  top_risk_reasons: string[];
  generated_at: string;
};

export type FlaggedActivityItem = {
  id: string;
  severity: "low" | "medium" | "high";
  label: string;
  description: string;
  occurred_at: string;
  session_id: string;
  path?: string | null;
  event_name?: string | null;
};

export type WebsiteThreatLeaderboard = {
  risky_sessions: Array<{
    session_id: string;
    severity: "low" | "medium" | "high";
    score: number;
    summary: string;
    occurred_at: string;
  }>;
  risky_paths: Array<{ path: string; count: number }>;
  risky_events: Array<{ event_name: string; count: number }>;
  repeated_patterns: Array<{ reason_code: string; count: number }>;
};

function severityFromScore(score: number): "low" | "medium" | "high" | "none" {
  if (score >= THREAT_RULES.highSeverityMin) return "high";
  if (score >= THREAT_RULES.mediumSeverityMin) return "medium";
  if (score >= THREAT_RULES.lowSeverityMin) return "low";
  return "none";
}

function toIso(value: Date): string {
  return value.toISOString();
}

async function getThreatColumnCaps(): Promise<ThreatColumnCaps> {
  if (columnCapsCache) return columnCapsCache;
  const pool = getPool();
  const result = await pool.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('sessions')`,
  );
  const has = (table: string, col: string) =>
    result.rows.some((r) => r.table_name === table && r.column_name === col);
  columnCapsCache = {
    sessionsPageviewCount: has("sessions", "pageview_count"),
    sessionsEventCount: has("sessions", "event_count"),
    sessionsDurationSeconds: has("sessions", "duration_seconds"),
    sessionsIsBounce: has("sessions", "is_bounce"),
    sessionsRiskScore: has("sessions", "risk_score"),
    sessionsMetadata: has("sessions", "metadata"),
  };
  return columnCapsCache;
}

export function evaluateSessionThreat(input: ThreatEvaluationInput): ThreatFlag | null {
  const {
    session,
    eventCount,
    pageviewCount,
    durationSeconds,
    maxSameEventCount,
    maxSamePathCount,
    dominantEventName,
    suspiciousPath,
    avgActionsPerSession,
  } = input;

  let score = 0;
  const reasons: string[] = [];
  const actions = eventCount + pageviewCount;
  const referrerMissing = !session.referrer_url || session.referrer_url.trim() === "";

  if (
    eventCount >= THREAT_RULES.rapidEventMinCount &&
    durationSeconds <= THREAT_RULES.rapidSessionDurationSec
  ) {
    score += THREAT_RULES.scoreRapidEventBurst;
    reasons.push("rapid_event_burst");
  }

  if (
    pageviewCount >= THREAT_RULES.highPageviewMinCount &&
    durationSeconds <= THREAT_RULES.densePageviewDurationSec
  ) {
    score += THREAT_RULES.scoreHighPageviewBurst;
    reasons.push("high_pageview_burst");
  }

  if (
    durationSeconds <= THREAT_RULES.shortHighIntensityDurationSec &&
    actions >= THREAT_RULES.shortHighIntensityActions
  ) {
    score += THREAT_RULES.scoreShortHighIntensity;
    reasons.push("short_high_intensity_session");
  }

  if (maxSameEventCount >= THREAT_RULES.repeatedSameEventMin) {
    score += THREAT_RULES.scoreRepeatedSameEvent;
    reasons.push("repeated_same_event");
  }

  if (maxSamePathCount >= THREAT_RULES.repeatedSamePathMin) {
    score += THREAT_RULES.scoreSuspiciousPathRepetition;
    reasons.push("suspicious_path_repetition");
  }

  if (session.is_bounce === true && eventCount >= THREAT_RULES.bounceEventMismatchMinEvents) {
    score += THREAT_RULES.scoreBounceEventMismatch;
    reasons.push("bounce_event_mismatch");
  }

  if (referrerMissing && actions >= THREAT_RULES.noReferrerHighIntensityActions) {
    score += THREAT_RULES.scoreNoReferrerHighIntensity;
    reasons.push("no_referrer_high_intensity");
  }

  if ((session.risk_score ?? 0) >= 0.8) {
    score += THREAT_RULES.scoreIngestRiskHint;
    reasons.push("ingest_risk_hint");
  }

  if (
    avgActionsPerSession > 0 &&
    actions >= THREAT_RULES.baselineMinActions &&
    actions >= avgActionsPerSession * THREAT_RULES.baselineDensityMultiplier
  ) {
    score += THREAT_RULES.scoreAboveBaselineDensity;
    reasons.push("above_baseline_density");
  }

  const severity = severityFromScore(score);
  if (severity === "none") return null;

  const activitySummary =
    reasons[0] === "rapid_event_burst"
      ? "High event burst in a short session."
      : reasons[0] === "high_pageview_burst"
        ? "Unusually dense pageview sequence detected."
        : reasons[0] === "repeated_same_event"
          ? "Repeated identical event activity detected."
          : "Session behavior appears unusually dense.";

  return {
    session_id: session.id,
    website_id: session.website_id,
    severity,
    score,
    reason_codes: reasons,
    summary: activitySummary,
    occurred_at: toIso(session.last_activity_at),
    path: suspiciousPath ?? session.entry_path,
    event_name: dominantEventName,
    metadata: session.metadata ?? null,
  };
}

async function computeThreatFlags(
  websiteId: string,
  lookbackHours = THREAT_RULES.lookbackHours,
): Promise<ThreatFlag[]> {
  const pool = getPool();
  const caps = await getThreatColumnCaps();

  const selectColumns = [
    "id",
    "website_id",
    "started_at",
    "last_activity_at",
    "entry_path",
    "referrer_url",
  ];
  if (caps.sessionsPageviewCount) selectColumns.push("pageview_count");
  if (caps.sessionsEventCount) selectColumns.push("event_count");
  if (caps.sessionsDurationSeconds) selectColumns.push("duration_seconds");
  if (caps.sessionsIsBounce) selectColumns.push("is_bounce");
  if (caps.sessionsRiskScore) selectColumns.push("risk_score");
  if (caps.sessionsMetadata) selectColumns.push("metadata");

  const sessionsResult = await pool.query<SessionBase>(
    `SELECT ${selectColumns.join(", ")}
     FROM sessions
     WHERE website_id = $1
       AND last_activity_at >= now() - ($2::text || ' hours')::interval
     ORDER BY last_activity_at DESC
     LIMIT $3`,
    [websiteId, String(lookbackHours), THREAT_RULES.maxSessionsEvaluated],
  );
  const sessions = sessionsResult.rows;
  if (sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);

  const [eventCounts, pageviewCounts, maxSameEventRows, maxSamePathRows] =
    await Promise.all([
      pool.query<{ session_id: string; count: string }>(
        `SELECT session_id, count(*)::text AS count
         FROM events
         WHERE website_id = $1
           AND session_id = ANY($2::uuid[])
         GROUP BY session_id`,
        [websiteId, sessionIds],
      ),
      pool.query<{ session_id: string; count: string }>(
        `SELECT session_id, count(*)::text AS count
         FROM pageviews
         WHERE website_id = $1
           AND session_id = ANY($2::uuid[])
         GROUP BY session_id`,
        [websiteId, sessionIds],
      ),
      pool.query<{ session_id: string; event_name: string; max_count: string }>(
        `SELECT t.session_id, t.name AS event_name, t.cnt::text AS max_count
         FROM (
           SELECT e.session_id, e.name, count(*) AS cnt,
                  row_number() OVER (PARTITION BY e.session_id ORDER BY count(*) DESC, e.name) AS rn
           FROM events e
           WHERE e.website_id = $1
             AND e.session_id = ANY($2::uuid[])
           GROUP BY e.session_id, e.name
         ) t
         WHERE t.rn = 1`,
        [websiteId, sessionIds],
      ),
      pool.query<{ session_id: string; path: string; max_count: string }>(
        `SELECT t.session_id, t.path, t.cnt::text AS max_count
         FROM (
           SELECT p.session_id, p.path, count(*) AS cnt,
                  row_number() OVER (PARTITION BY p.session_id ORDER BY count(*) DESC, p.path) AS rn
           FROM pageviews p
           WHERE p.website_id = $1
             AND p.session_id = ANY($2::uuid[])
           GROUP BY p.session_id, p.path
         ) t
         WHERE t.rn = 1`,
        [websiteId, sessionIds],
      ),
    ]);

  const eventCountMap = new Map(eventCounts.rows.map((r) => [r.session_id, Number(r.count)]));
  const pageviewCountMap = new Map(
    pageviewCounts.rows.map((r) => [r.session_id, Number(r.count)]),
  );
  const maxSameEventMap = new Map(
    maxSameEventRows.rows.map((r) => [r.session_id, Number(r.max_count)]),
  );
  const dominantEventMap = new Map(
    maxSameEventRows.rows.map((r) => [r.session_id, r.event_name]),
  );
  const maxSamePathMap = new Map(
    maxSamePathRows.rows.map((r) => [r.session_id, Number(r.max_count)]),
  );
  const suspiciousPathMap = new Map(maxSamePathRows.rows.map((r) => [r.session_id, r.path]));

  const actionTotals = sessions.map((s) => {
    const eventCount = caps.sessionsEventCount
      ? Number(s.event_count ?? eventCountMap.get(s.id) ?? 0)
      : Number(eventCountMap.get(s.id) ?? 0);
    const pageviewCount = caps.sessionsPageviewCount
      ? Number(s.pageview_count ?? pageviewCountMap.get(s.id) ?? 0)
      : Number(pageviewCountMap.get(s.id) ?? 0);
    return eventCount + pageviewCount;
  });
  const avgActionsPerSession =
    actionTotals.length > 0
      ? actionTotals.reduce((sum, value) => sum + value, 0) / actionTotals.length
      : 0;

  const flags: ThreatFlag[] = [];
  for (const session of sessions) {
    const eventCount = caps.sessionsEventCount
      ? Number(session.event_count ?? eventCountMap.get(session.id) ?? 0)
      : Number(eventCountMap.get(session.id) ?? 0);
    const pageviewCount = caps.sessionsPageviewCount
      ? Number(session.pageview_count ?? pageviewCountMap.get(session.id) ?? 0)
      : Number(pageviewCountMap.get(session.id) ?? 0);
    const durationSeconds = caps.sessionsDurationSeconds
      ? Number(
          session.duration_seconds ??
            Math.max(
              0,
              Math.round(
                (session.last_activity_at.getTime() - session.started_at.getTime()) / 1000,
              ),
            ),
        )
      : Math.max(
          0,
          Math.round((session.last_activity_at.getTime() - session.started_at.getTime()) / 1000),
        );
    const maxSameEventCount = Number(maxSameEventMap.get(session.id) ?? 0);
    const maxSamePathCount = Number(maxSamePathMap.get(session.id) ?? 0);
    const flag = evaluateSessionThreat({
      session,
      eventCount,
      pageviewCount,
      durationSeconds,
      maxSameEventCount,
      maxSamePathCount,
      dominantEventName: dominantEventMap.get(session.id) ?? null,
      suspiciousPath: suspiciousPathMap.get(session.id) ?? null,
      avgActionsPerSession,
    });
    if (flag) flags.push(flag);
  }

  flags.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime();
  });
  return flags;
}

export async function getWebsiteThreatOverview(
  websiteId: string,
): Promise<WebsiteThreatOverview> {
  const flags = await computeThreatFlags(websiteId);
  const high = flags.filter((f) => f.severity === "high").length;
  const medium = flags.filter((f) => f.severity === "medium").length;
  const low = flags.filter((f) => f.severity === "low").length;

  const reasonCounts = new Map<string, number>();
  for (const flag of flags) {
    for (const code of flag.reason_codes) {
      reasonCounts.set(code, (reasonCounts.get(code) ?? 0) + 1);
    }
  }
  const topReasons = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([code]) => code);

  return {
    total_flagged_sessions: flags.length,
    high_risk_sessions: high,
    medium_risk_sessions: medium,
    low_risk_sessions: low,
    flagged_activity_count: flags.length,
    recent_flags: flags.slice(0, 20),
    top_risk_reasons: topReasons,
    generated_at: new Date().toISOString(),
  };
}

export async function getWebsiteFlaggedActivity(
  websiteId: string,
  limit = 12,
  precomputedOverview?: WebsiteThreatOverview,
): Promise<FlaggedActivityItem[]> {
  const overview = precomputedOverview ?? (await getWebsiteThreatOverview(websiteId));
  return overview.recent_flags.slice(0, limit).map((flag) => ({
    id: `${flag.session_id}:${flag.score}`,
    severity: flag.severity,
    label: `${flag.severity.toUpperCase()} risk`,
    description: flag.summary,
    occurred_at: flag.occurred_at,
    session_id: flag.session_id,
    path: flag.path ?? null,
    event_name: flag.event_name ?? null,
  }));
}

export async function getWebsiteThreatLeaderboard(
  websiteId: string,
  precomputedOverview?: WebsiteThreatOverview,
): Promise<WebsiteThreatLeaderboard> {
  const overview = precomputedOverview ?? (await getWebsiteThreatOverview(websiteId));
  const flags = overview.recent_flags;

  const riskyPaths = new Map<string, number>();
  const riskyEvents = new Map<string, number>();
  const repeatedPatterns = new Map<string, number>();

  for (const flag of flags) {
    if (flag.path) {
      riskyPaths.set(flag.path, (riskyPaths.get(flag.path) ?? 0) + 1);
    }
    if (flag.event_name) {
      riskyEvents.set(flag.event_name, (riskyEvents.get(flag.event_name) ?? 0) + 1);
    }
    for (const code of flag.reason_codes) {
      repeatedPatterns.set(code, (repeatedPatterns.get(code) ?? 0) + 1);
    }
  }

  return {
    risky_sessions: flags.slice(0, 10).map((flag) => ({
      session_id: flag.session_id,
      severity: flag.severity,
      score: flag.score,
      summary: flag.summary,
      occurred_at: flag.occurred_at,
    })),
    risky_paths: [...riskyPaths.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([path, count]) => ({ path, count })),
    risky_events: [...riskyEvents.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([event_name, count]) => ({ event_name, count })),
    repeated_patterns: [...repeatedPatterns.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([reason_code, count]) => ({ reason_code, count })),
  };
}

export { THREAT_RULES };
