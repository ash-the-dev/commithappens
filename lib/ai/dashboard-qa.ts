import "server-only";
import { getSiteAnalytics } from "@/lib/db/analytics";
import { getWebsiteInsights } from "@/lib/db/insights";
import {
  getWebsiteThreatLeaderboard,
  getWebsiteThreatOverview,
  type WebsiteThreatLeaderboard,
  type WebsiteThreatOverview,
} from "@/lib/db/threats";
import { getWebsiteChangeImpacts, type ChangeImpactResult } from "@/lib/db/change-impact";
import { getPool } from "@/lib/db/pool";
import { buildWebsiteSummaryInput } from "@/lib/ai/build-website-summary-input";
import { buildSpikeExplanationInput } from "@/lib/ai/build-spike-explanation-input";
import { buildChangeImpactNarrativeInput } from "@/lib/ai/build-change-impact-narrative-input";
import { buildRecommendedActionsInput } from "@/lib/ai/build-recommended-actions-input";
import { getOpenAiClient, isOpenAiConfigured } from "@/lib/ai/client";
import { getFastAiModel, getPrimaryAiModel } from "@/lib/ai/models";
import {
  DASHBOARD_ANSWER_JSON_SCHEMA,
  validateDashboardAnswerOutput,
} from "@/lib/ai/schemas";
import type {
  DashboardAnswerOutput,
  DashboardAnswerResult,
  DashboardQuestionEvidence,
  DashboardQuestionIntent,
  WebsiteAiSummaryInput,
  WebsiteRecommendationsInput,
} from "@/lib/ai/types";

const QA_CACHE_TTL_MS = 3 * 60 * 1000;
const qaCache = new Map<string, { expiresAt: number; value: DashboardAnswerResult }>();

const SUGGESTED_INTENTS: DashboardQuestionIntent[] = [
  "summary",
  "spike_explanation",
  "threat_analysis",
  "change_impact",
  "recommendations",
  "performance_analysis",
  "uptime_analysis",
];

function normalizeQuestion(question: string): string {
  return question.trim().toLowerCase().replace(/\s+/g, " ");
}

function detectTimeScope(question: string): DashboardQuestionEvidence["time_scope"] {
  const q = normalizeQuestion(question);
  if (q.includes("yesterday")) return "yesterday";
  if (q.includes("today")) return "today";
  if (q.includes("latest")) return "latest";
  if (q.includes("recent") || q.includes("last week")) return "recent";
  return "unknown";
}

export function classifyDashboardQuestion(question: string): DashboardQuestionIntent {
  const q = normalizeQuestion(question);
  if (!q || q.length < 4) return "insufficient_scope";
  if (
    q.includes("recommend") ||
    q.includes("fix first") ||
    q.includes("next action") ||
    q.includes("what should i do")
  ) {
    return "recommendations";
  }
  if (
    q.includes("spike") ||
    q.includes("drop") ||
    q.includes("why did traffic") ||
    q.includes("why did conversion")
  ) {
    return "spike_explanation";
  }
  if (
    q.includes("suspicious") ||
    q.includes("threat") ||
    q.includes("risk") ||
    q.includes("attack")
  ) {
    return "threat_analysis";
  }
  if (
    q.includes("deploy") ||
    q.includes("change") ||
    q.includes("release") ||
    q.includes("what changed")
  ) {
    return "change_impact";
  }
  if (
    q.includes("performance") ||
    q.includes("lcp") ||
    q.includes("cls") ||
    q.includes("inp") ||
    q.includes("slow")
  ) {
    return "performance_analysis";
  }
  if (
    q.includes("uptime") ||
    q.includes("downtime") ||
    q.includes("outage") ||
    q.includes("availability")
  ) {
    return "uptime_analysis";
  }
  if (
    q.includes("what's going on") ||
    q.includes("whats going on") ||
    q.includes("status") ||
    q.includes("summary") ||
    q.includes("overview")
  ) {
    return "summary";
  }
  return "insufficient_scope";
}

function yesterdayIsoDay(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

type SharedData = {
  websiteName: string;
  summaryInput: WebsiteAiSummaryInput;
  recommendationsInput: WebsiteRecommendationsInput;
  anomalies: DashboardQuestionEvidence["anomalies"];
  threatOverview: WebsiteThreatOverview;
  threatLeaderboard: WebsiteThreatLeaderboard;
  latestChangeImpact: ChangeImpactResult | null;
  latestChangeNarrativeInput: DashboardQuestionEvidence["latest_change"];
  latestSpikeInput: DashboardQuestionEvidence["latest_spike"];
  uptime: DashboardQuestionEvidence["uptime"];
  performance: DashboardQuestionEvidence["performance"];
};

async function gatherSharedData(
  websiteId: string,
  question: string,
): Promise<SharedData> {
  const [analytics, threatOverview, changeImpacts] = await Promise.all([
    getSiteAnalytics(websiteId),
    getWebsiteThreatOverview(websiteId),
    getWebsiteChangeImpacts(websiteId),
  ]);
  const [insights, threatLeaderboard, recommendationsInput] = await Promise.all([
    getWebsiteInsights(websiteId, threatOverview),
    getWebsiteThreatLeaderboard(websiteId, threatOverview),
    buildRecommendedActionsInput(websiteId),
  ]);
  const latestChange = changeImpacts[0] ?? null;
  const latestChangeNarrativeInput = latestChange
    ? await buildChangeImpactNarrativeInput(latestChange.change_log_id)
    : null;

  const scope = detectTimeScope(question);
  const requestedAnomaly =
    scope === "yesterday"
      ? insights.anomalies.find((a) => a.date === yesterdayIsoDay()) ?? insights.anomalies[0]
      : insights.anomalies[0];
  const latestSpikeInput = requestedAnomaly
    ? await buildSpikeExplanationInput(websiteId, requestedAnomaly.date, requestedAnomaly)
    : null;

  return {
    websiteName: recommendationsInput.website_name,
    summaryInput: buildWebsiteSummaryInput({
      websiteName: recommendationsInput.website_name,
      analytics,
      insights,
      threatOverview,
      changeImpacts,
    }),
    recommendationsInput,
    anomalies: insights.anomalies.slice(0, 8).map((a) => ({
      date: a.date,
      metric_type: a.metric_type,
      anomaly_type: a.anomaly_type,
      percent_change: a.percent_change,
    })),
    threatOverview,
    threatLeaderboard,
    latestChangeImpact: latestChange,
    latestChangeNarrativeInput,
    latestSpikeInput,
    uptime: {
      has_checks: analytics.uptime.hasChecks24h,
      checks_24h: analytics.uptime.checks24h,
      checks_up_24h: analytics.uptime.checksUp24h,
      uptime_pct_24h: analytics.uptime.uptimePct24h,
      failures_24h: analytics.uptime.checks24h - analytics.uptime.checksUp24h,
    },
    performance: {
      vitals: analytics.vitalAverages.slice(0, 5),
      problematic_metrics: recommendationsInput.performance_signals.problematic_metrics,
      top_pages: analytics.topPages.slice(0, 4),
    },
  };
}

export async function routeDashboardQuestion(
  question: string,
  websiteId: string,
): Promise<DashboardQuestionEvidence> {
  const normalized = normalizeQuestion(question);
  const intent = classifyDashboardQuestion(question);
  const scope = detectTimeScope(question);
  const shared = await gatherSharedData(websiteId, question);

  return {
    website_name: shared.websiteName,
    question: question.trim(),
    normalized_question: normalized,
    intent,
    time_scope: scope,
    summary: shared.summaryInput,
    anomalies: shared.anomalies,
    latest_spike: shared.latestSpikeInput,
    latest_change: shared.latestChangeNarrativeInput,
    threat: {
      total_flagged_sessions: shared.threatOverview.total_flagged_sessions,
      high_risk_sessions: shared.threatOverview.high_risk_sessions,
      top_risk_reasons: shared.threatOverview.top_risk_reasons,
      risky_paths: shared.threatLeaderboard.risky_paths.map((p) => p.path).slice(0, 5),
      risky_events: shared.threatLeaderboard.risky_events.map((e) => e.event_name).slice(0, 5),
    },
    recommendations: shared.recommendationsInput,
    uptime: shared.uptime,
    performance: shared.performance,
  };
}

export function buildFallbackDashboardAnswer(
  intent: DashboardQuestionIntent,
  evidence: DashboardQuestionEvidence,
): DashboardAnswerResult {
  const resultBase = {
    source: "fallback" as const,
    model: null,
    generated_at: new Date().toISOString(),
  };

  if (intent === "insufficient_scope") {
    return {
      ...resultBase,
      data: {
        answer:
          "This question is outside the current supported dashboard analyst scope. Ask about summary, spikes/drops, threats, change impact, recommendations, performance, or uptime.",
        evidence_points: [
          `Supported intents: ${SUGGESTED_INTENTS.join(", ")}.`,
          "Current implementation is intentionally scoped to measurable website signals.",
        ],
        recommended_followups: [
          "Ask: What's going on with this site?",
          "Ask: Why did traffic spike?",
          "Ask: What suspicious activity should I review?",
        ],
        confidence_note: "Fallback response due to unsupported question scope.",
        intent,
        source_label: "fallback",
        limitation_note: "Freeform or external business questions are not supported yet.",
        time_scope: evidence.time_scope,
      },
    };
  }

  const topUrgent = evidence.recommendations.recommended_priority_context.candidates
    .filter((c) => c.priority === "critical" || c.priority === "high")
    .map((c) => c.suggested_action)
    .slice(0, 3);

  if (intent === "summary") {
    return {
      ...resultBase,
      data: {
        answer: evidence.summary.deterministic_signals.insight_summary,
        evidence_points: [
          `${evidence.summary.summary_24h.sessions} sessions and ${evidence.summary.summary_24h.pageviews} pageviews in 24h.`,
          `${evidence.anomalies.length} anomaly signal(s) detected in the recent timeline.`,
          `${evidence.threat.total_flagged_sessions} flagged session(s) in the threat window.`,
        ],
        recommended_followups: topUrgent.length > 0 ? topUrgent : ["Review top-page and event shifts for the latest anomaly day."],
        confidence_note: "Fallback summary grounded in computed dashboard aggregates.",
        intent,
        source_label: "fallback",
        time_scope: evidence.time_scope,
      },
    };
  }

  if (intent === "spike_explanation") {
    const spike = evidence.latest_spike;
    if (!spike) {
      return {
        ...resultBase,
        data: {
          answer: "No notable recent spike/drop was detected with enough evidence to explain.",
          evidence_points: ["Anomaly detector did not return a strong recent spike/drop."],
          recommended_followups: ["Ask for a site summary to review current trends."],
          confidence_note: "Fallback response with limited anomaly evidence.",
          intent,
          source_label: "fallback",
          limitation_note: "This version focuses on the latest detected anomaly window.",
          time_scope: evidence.time_scope,
        },
      };
    }
    return {
      ...resultBase,
      data: {
        answer: `The latest ${spike.anomaly_type} on ${spike.target_date} aligns with measurable traffic and behavior shifts.`,
        evidence_points: [
          `Pageviews delta: ${spike.metric_deltas.pageviews_pct.toFixed(1)}%.`,
          ...spike.strongest_factors.slice(0, 2),
        ],
        recommended_followups: [
          "Review top page and event deltas for the anomaly window.",
          "Compare this window with recent change logs and uptime events.",
        ],
        confidence_note: "Fallback explanation based on deterministic comparative evidence.",
        intent,
        source_label: "fallback",
        time_scope: spike.target_date,
      },
    };
  }

  if (intent === "threat_analysis") {
    return {
      ...resultBase,
      data: {
        answer:
          evidence.threat.total_flagged_sessions > 0
            ? "Suspicious activity is present and concentrated in a subset of sessions."
            : "No notable suspicious activity is currently detected in the recent threat window.",
        evidence_points: [
          `${evidence.threat.total_flagged_sessions} flagged session(s), ${evidence.threat.high_risk_sessions} high-risk.`,
          `Top reasons: ${evidence.threat.top_risk_reasons.slice(0, 3).join(", ") || "none"}.`,
          `Risky paths: ${evidence.threat.risky_paths.slice(0, 2).join(", ") || "none"}.`,
        ],
        recommended_followups: [
          "Inspect flagged sessions and repeated reason-code patterns.",
          "Review top risky paths/events for automation-like behavior.",
        ],
        confidence_note: "Fallback threat answer based on rule-scored session signals.",
        intent,
        source_label: "fallback",
        time_scope: "recent",
      },
    };
  }

  if (intent === "change_impact") {
    if (!evidence.latest_change) {
      return {
        ...resultBase,
        data: {
          answer: "No recent recorded changes are available for impact analysis.",
          evidence_points: ["Change log coverage is missing or no recent change exists."],
          recommended_followups: ["Record the latest deploy/change to enable impact correlation."],
          confidence_note: "Fallback response due to missing change evidence.",
          intent,
          source_label: "fallback",
          limitation_note: "This version summarizes the latest recorded change only.",
          time_scope: "latest",
        },
      };
    }
    return {
      ...resultBase,
      data: {
        answer: `Latest change "${evidence.latest_change.change_log.title}" was followed by measurable movement in core metrics.`,
        evidence_points: [
          `Sessions delta: ${evidence.latest_change.metric_deltas.sessions_percent_change.toFixed(1)}%.`,
          `Pageviews delta: ${evidence.latest_change.metric_deltas.pageviews_percent_change.toFixed(1)}%.`,
          ...evidence.latest_change.strongest_factors.slice(0, 1),
        ],
        recommended_followups: [
          "Verify that post-change metric movement matches intended release outcomes.",
          "Review uptime/threat context in the same post-change window.",
        ],
        confidence_note: "Fallback change-impact answer derived from deterministic before/after evidence.",
        intent,
        source_label: "fallback",
        time_scope: "latest",
      },
    };
  }

  if (intent === "recommendations") {
    const urgent = evidence.recommendations.recommended_priority_context.candidates
      .filter((c) => c.priority === "critical" || c.priority === "high")
      .map((c) => c.suggested_action)
      .slice(0, 3);
    const next = evidence.recommendations.recommended_priority_context.candidates
      .filter((c) => c.priority === "medium")
      .map((c) => c.suggested_action)
      .slice(0, 2);
    return {
      ...resultBase,
      data: {
        answer:
          urgent.length > 0
            ? "Start with the urgent stuff, then handle medium-priority follow-ups."
            : "Nothing urgent right now; focus on medium-priority improvements.",
        evidence_points: [
          `Highest priority: ${evidence.recommendations.recommended_priority_context.highest_priority}.`,
          ...evidence.recommendations.strongest_issues.slice(0, 2),
        ],
        recommended_followups: [...urgent, ...next].slice(0, 5),
        confidence_note: "Fallback recommendations grounded in deterministic priority scoring.",
        intent,
        source_label: "fallback",
        time_scope: "recent",
      },
    };
  }

  if (intent === "performance_analysis") {
    const bad = evidence.performance.problematic_metrics;
    return {
      ...resultBase,
      data: {
        answer:
          bad.length > 0
            ? `Performance concerns are concentrated in ${bad.join(", ")} and should be investigated on top-traffic pages.`
            : "No major vitals regressions are currently flagged in the recent window.",
        evidence_points: [
          ...evidence.performance.vitals
            .slice(0, 3)
            .map((v) => `${v.metric}: avg ${v.average.toFixed(2)} (${v.samples} samples)`),
          `Top pages: ${evidence.performance.top_pages.map((p) => p.path).slice(0, 2).join(", ") || "none"}.`,
        ],
        recommended_followups: [
          "Inspect performance on highest-traffic pages first.",
          "Check for regressions in render-blocking resources and layout shifts.",
        ],
        confidence_note: "Fallback performance answer based on 7-day vitals aggregates.",
        intent,
        source_label: "fallback",
        time_scope: "recent",
      },
    };
  }

  return {
    ...resultBase,
    data: {
      answer:
        evidence.uptime.has_checks && evidence.uptime.failures_24h > 0
          ? "Uptime incidents were recorded and may have affected user experience."
          : evidence.uptime.has_checks
            ? "No uptime failures are recorded in the latest 24-hour window."
            : "Uptime checks are not configured, so availability impact cannot be confirmed.",
      evidence_points: [
        `Checks: ${evidence.uptime.checks_24h}, failures: ${evidence.uptime.failures_24h}.`,
        `Uptime: ${evidence.uptime.uptime_pct_24h.toFixed(2)}%.`,
      ],
      recommended_followups: [
        "Review failed-check windows against traffic and conversion shifts.",
        "Ensure critical endpoints are covered by uptime checks.",
      ],
      confidence_note: "Fallback uptime answer based on recent uptime log aggregates.",
      intent: "uptime_analysis",
      source_label: "fallback",
      time_scope: "24h",
    },
  };
}

async function callAnalystModel(
  model: string,
  evidence: DashboardQuestionEvidence,
): Promise<DashboardAnswerOutput> {
  const client = getOpenAiClient();
  const response = await client.responses.create({
    model,
    instructions:
      "You are the CommitHappens dashboard analyst. Answer using only provided evidence in plain English for indie builders. Be direct, useful, and slightly playful without being chaotic. If evidence is insufficient, say so clearly. Avoid unsupported causation claims and generic filler. Return valid JSON only.",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Question: ${evidence.question}\nIntent: ${evidence.intent}\nEvidence: ${JSON.stringify(evidence)}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "dashboard_answer",
        schema: DASHBOARD_ANSWER_JSON_SCHEMA,
        strict: true,
      },
    },
  });
  const raw = response.output_text;
  if (!raw || raw.trim().length === 0) throw new Error("empty_ai_output");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("invalid_json_output");
  }
  const validated = validateDashboardAnswerOutput(parsed);
  if (!validated.ok) throw new Error(`invalid_schema_output:${validated.error}`);
  return validated.data;
}

export async function answerWebsiteQuestion(
  websiteId: string,
  question: string,
): Promise<DashboardAnswerResult> {
  const evidence = await routeDashboardQuestion(question, websiteId);
  const key = JSON.stringify({
    websiteId,
    q: evidence.normalized_question,
    intent: evidence.intent,
    scope: evidence.time_scope,
    summary: evidence.summary.summary_24h,
    anomalies: evidence.anomalies.slice(0, 2),
    threat: evidence.threat.total_flagged_sessions,
  });
  const cached = qaCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  if (evidence.intent === "insufficient_scope") {
    return buildFallbackDashboardAnswer(evidence.intent, evidence);
  }

  if (!isOpenAiConfigured()) {
    return buildFallbackDashboardAnswer(evidence.intent, evidence);
  }

  const models = [getPrimaryAiModel(), getFastAiModel()];
  let lastError = "ai_generation_failed";
  for (const model of models) {
    try {
      const data = await callAnalystModel(model, evidence);
      const result: DashboardAnswerResult = {
        source: "ai",
        model,
        generated_at: new Date().toISOString(),
        data: { ...data, source_label: "ai" },
      };
      qaCache.set(key, { expiresAt: Date.now() + QA_CACHE_TTL_MS, value: result });
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  const fallback = buildFallbackDashboardAnswer(evidence.intent, evidence);
  return { ...fallback, error: lastError };
}

export async function getWebsiteNameForQa(websiteId: string): Promise<string> {
  const pool = getPool();
  const res = await pool.query<{ name: string }>(
    `SELECT name FROM websites WHERE id = $1::uuid LIMIT 1`,
    [websiteId],
  );
  return res.rows[0]?.name ?? "Website";
}

