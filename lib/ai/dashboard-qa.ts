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
import { getFastAiModel } from "@/lib/ai/models";
import {
  DASHBOARD_ANSWER_JSON_SCHEMA,
  validateDashboardAnswerOutput,
} from "@/lib/ai/schemas";
import {
  buildPatternResponse,
  patternToDashboardAnswer,
  type AiResponsePatternKey,
} from "@/services/aiResponsePatterns";
import type {
  DashboardAnswerOutput,
  DashboardAnswerResult,
  DashboardQuestionEvidence,
  DashboardQuestionIntent,
  WebsiteAiSummaryInput,
  WebsiteRecommendationsInput,
} from "@/lib/ai/types";

const MODEL_TIMEOUT_MS = 6_000;

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

type DashboardQaOptions = {
  currentTab?: string | null;
};

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
  websiteDomain: string | null;
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
  const [analytics, threatOverview, changeImpacts, websiteResult] = await Promise.all([
    getSiteAnalytics(websiteId),
    getWebsiteThreatOverview(websiteId),
    getWebsiteChangeImpacts(websiteId),
    getPool().query<{ primary_domain: string | null }>(
      `SELECT primary_domain FROM websites WHERE id = $1::uuid LIMIT 1`,
      [websiteId],
    ),
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
    websiteDomain: websiteResult.rows[0]?.primary_domain ?? null,
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
  options: DashboardQaOptions = {},
): Promise<DashboardQuestionEvidence> {
  const normalized = normalizeQuestion(question);
  const intent = classifyDashboardQuestion(question);
  const scope = detectTimeScope(question);
  const shared = await gatherSharedData(websiteId, question);

  return {
    website_name: shared.websiteName,
    website_domain: shared.websiteDomain ?? undefined,
    question: question.trim(),
    normalized_question: normalized,
    intent,
    time_scope: scope,
    current_tab: options.currentTab ?? null,
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

function priorityFromCandidate(priority: string): "critical" | "high" | "medium" | "low" | "none" {
  if (priority === "critical" || priority === "high" || priority === "medium" || priority === "low") {
    return priority;
  }
  return "none";
}

function buildPatternDashboardAnswer(
  intent: DashboardQuestionIntent,
  evidence: DashboardQuestionEvidence,
): DashboardAnswerOutput | null {
  const siteLabel = evidence.website_domain || evidence.website_name;
  const traffic = evidence.summary.summary_24h;
  const priorityCandidates = evidence.recommendations.recommended_priority_context.candidates;
  const urgent = priorityCandidates
    .filter((candidate) => candidate.priority === "critical" || candidate.priority === "high")
    .slice(0, 3);
  const topCandidate = urgent[0] ?? priorityCandidates[0] ?? null;
  const basedOn = [
    `${siteLabel}: ${traffic.sessions} sessions, ${traffic.pageviews} pageviews, ${traffic.events} events in 24h.`,
    `${evidence.uptime.checks_24h} uptime checks with ${evidence.uptime.failures_24h} failure(s) in 24h.`,
    `${evidence.threat.total_flagged_sessions} flagged session(s), ${evidence.threat.high_risk_sessions} high-risk.`,
    `${evidence.anomalies.length} recent anomaly signal(s).`,
    ...(evidence.performance.top_pages[0] ? [`Top page: ${evidence.performance.top_pages[0].path}.`] : []),
    ...(evidence.current_tab ? [`Asked from dashboard context: ${evidence.current_tab}.`] : []),
  ];

  if (intent === "summary") {
    const pattern: AiResponsePatternKey =
      traffic.sessions <= 0
        ? "no_data"
        : evidence.anomalies.some((a) => a.anomaly_type === "drop")
          ? "negative_trend"
          : traffic.sessions > 0
            ? "positive_trend"
            : "all_clear";
    const noTraffic =
      "Traffic data is quiet right now. Either the tracker is new, not installed yet, or your site is having a very private little party.";
    const response = buildPatternResponse({
      pattern,
      seed: `${siteLabel}:summary:${traffic.sessions}:${evidence.anomalies.length}`,
      what:
        traffic.sessions <= 0
          ? noTraffic
          : `${siteLabel} had ${traffic.sessions} session${traffic.sessions === 1 ? "" : "s"} and ${traffic.pageviews} pageview${traffic.pageviews === 1 ? "" : "s"} in the last 24 hours. ${evidence.anomalies.length} recent anomaly signal${evidence.anomalies.length === 1 ? "" : "s"} are on the board.`,
      why:
        traffic.sessions <= 0
          ? "Without traffic, I can confirm setup signals but not visitor behavior. No fake prophecy today."
          : "Traffic plus uptime and risk signals tell us whether visitors can arrive, move around, and avoid weird little blockers.",
      next: topCandidate
        ? `Start here: ${topCandidate.suggested_action}`
        : "Start by checking the top page and making sure the primary call-to-action is obvious.",
      checklist: [
        topCandidate?.suggested_action ?? "Confirm the tracker is installed on the live pages you care about.",
        "Review the top traffic page first.",
        "Check uptime failures before polishing copy.",
      ],
      priority: topCandidate ? priorityFromCandidate(topCandidate.priority) : "low",
      confidence: traffic.sessions <= 0 ? "needs more data" : "stored data",
      basedOn,
    });
    return patternToDashboardAnswer({ pattern: response, evidence, intent, sourceLabel: "fallback" });
  }

  if (intent === "recommendations") {
    const response = buildPatternResponse({
      pattern: urgent.length > 1 ? "multiple_issues" : urgent.length === 1 ? "critical_issue" : "improvement_opportunity",
      seed: `${siteLabel}:recommendations:${topCandidate?.title ?? "none"}`,
      what: topCandidate
        ? `The top priority is "${topCandidate.title}" because ${topCandidate.rationale.toLowerCase()}`
        : "No critical issue is standing on the table yelling right now.",
      why: topCandidate
        ? "Fixing the highest-impact item first keeps limited crawl and review time from getting spent on decorative nonsense."
        : "When nothing critical is flagged, the best move is tightening the pages and actions that already get attention.",
      next: topCandidate
        ? `Fix this before anything else: ${topCandidate.suggested_action}`
        : "This can wait: save deep polish for after you confirm traffic, uptime, and primary page clarity are healthy.",
      checklist: [
        ...urgent.map((candidate) => candidate.suggested_action),
        ...priorityCandidates.filter((candidate) => candidate.priority === "medium").map((candidate) => candidate.suggested_action),
      ].slice(0, 5),
      priority: topCandidate ? priorityFromCandidate(topCandidate.priority) : "low",
      confidence: "stored data",
      basedOn: [...basedOn, ...evidence.recommendations.strongest_issues.slice(0, 2)],
    });
    return patternToDashboardAnswer({ pattern: response, evidence, intent, sourceLabel: "fallback" });
  }

  if (intent === "uptime_analysis") {
    const hasFailures = evidence.uptime.has_checks && evidence.uptime.failures_24h > 0;
    const response = buildPatternResponse({
      pattern: hasFailures ? "critical_issue" : evidence.uptime.has_checks ? "positive_trend" : "no_data",
      seed: `${siteLabel}:uptime:${evidence.uptime.failures_24h}`,
      what: evidence.uptime.has_checks
        ? `${siteLabel} has ${evidence.uptime.checks_24h} stored uptime check${evidence.uptime.checks_24h === 1 ? "" : "s"} in 24h with ${evidence.uptime.failures_24h} failure${evidence.uptime.failures_24h === 1 ? "" : "s"} and ${evidence.uptime.uptime_pct_24h.toFixed(2)}% uptime.`
        : "Uptime data is not available yet, so I cannot claim the site stayed reachable.",
      why: hasFailures
        ? "Availability comes before SEO sparkle. If people or crawlers hit a dead site, the rest of the polish gets ignored."
        : "Reliable uptime means users and search engines can actually reach the site. Stable but invisible is still a problem, but stable is the first win.",
      next: hasFailures
        ? "Start here: compare the failed-check windows against traffic drops, deploys, and hosting logs."
        : "Next step: keep uptime clean, then use SEO Crawl to make sure the reachable pages are also understandable.",
      checklist: [
        hasFailures ? "Open the failed uptime windows." : "Confirm the primary URL is covered by monitoring.",
        "Compare failures with recent deploys or DNS changes.",
        "Check the homepage and top page from a private browser window.",
      ],
      priority: hasFailures ? "critical" : "low",
      confidence: evidence.uptime.has_checks ? "stored data" : "needs more data",
      basedOn,
    });
    return patternToDashboardAnswer({ pattern: response, evidence, intent, sourceLabel: "fallback" });
  }

  if (intent === "threat_analysis") {
    const hasMentions = evidence.threat.total_flagged_sessions > 0;
    const response = buildPatternResponse({
      pattern: hasMentions ? "issue_detected" : "all_clear",
      seed: `${siteLabel}:threat:${evidence.threat.total_flagged_sessions}`,
      what: hasMentions
        ? `${evidence.threat.total_flagged_sessions} flagged session${evidence.threat.total_flagged_sessions === 1 ? "" : "s"} showed up, including ${evidence.threat.high_risk_sessions} high-risk.`
        : "No public mentions found from your watch terms yet. That’s either peaceful or suspiciously quiet. Keep watching.",
      why: hasMentions
        ? "Flagged sessions can point to bot behavior, weird paths, or repeated patterns that waste time and muddy analytics."
        : "No flags means there is nothing obvious to respond to right now, which is useful because not every quiet room contains a ghost.",
      next: hasMentions
        ? `Start here: review ${evidence.threat.risky_paths[0] ?? "the top risky path"} and the top reason ${evidence.threat.top_risk_reasons[0] ?? "flagged by the rules"}.`
        : "Keep watch terms fresh and review again after new public activity lands.",
      checklist: [
        "Review high-risk sessions first.",
        "Look for repeated risky paths or events.",
        "Ignore one-off weirdness unless it repeats.",
      ],
      priority: hasMentions ? "medium" : "none",
      confidence: "stored data",
      basedOn,
    });
    return patternToDashboardAnswer({ pattern: response, evidence, intent, sourceLabel: "fallback" });
  }

  return null;
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

  const patternAnswer = buildPatternDashboardAnswer(intent, evidence);
  if (patternAnswer) {
    return {
      ...resultBase,
      data: patternAnswer,
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
  signal?: AbortSignal,
): Promise<DashboardAnswerOutput> {
  const client = getOpenAiClient();
  const response = await client.responses.create(
    {
      model,
      instructions:
        "You are the Commit Happens dashboard analyst. Answer using only provided stored dashboard evidence in plain English for small business owners. Use this structure inside the answer when useful: What I’m seeing, Why it matters, What to do next, Tiny checklist, Suggested wording only when evidence supports it. Be playful but controlled, snarky but helpful, and never corporate. Do not invent scan data, do not claim a live check happened, do not expose secrets or raw stack traces, and do not mention unavailable/planned integrations. If evidence is insufficient, say so clearly. Prioritize fixes in this order when relevant: critical SEO/status errors, uptime issues, missing metadata on important pages, traffic drops, reputation flags. Return valid JSON only.",
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
    },
    { signal },
  );
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
  const fallback = patternToDashboardAnswer({
    pattern: buildPatternResponse({
      pattern: "improvement_opportunity",
      seed: `${evidence.website_name}:${evidence.intent}:${evidence.question}`,
      what: validated.data.answer,
      why: validated.data.evidence_points[0] ?? "This is based on stored dashboard evidence, not a live re-check.",
      next: validated.data.recommended_followups[0] ?? "Start with the highest-impact item listed in the dashboard.",
      checklist: validated.data.recommended_followups,
      priority: "medium",
      confidence: "stored data",
      basedOn: validated.data.evidence_points,
    }),
    evidence,
    intent: validated.data.intent,
    sourceLabel: "ai",
    limitationNote: validated.data.limitation_note,
  });
  return {
    ...validated.data,
    sections: fallback.sections,
    checklist: fallback.checklist,
    priority: fallback.priority,
    confidence: fallback.confidence,
    basedOn: fallback.basedOn,
  };
}

async function callAnalystModelWithTimeout(
  model: string,
  evidence: DashboardQuestionEvidence,
): Promise<DashboardAnswerOutput> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("ai_generation_timeout"), MODEL_TIMEOUT_MS);
  try {
    return await callAnalystModel(model, evidence, controller.signal);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error("ai_generation_timeout");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function answerWebsiteQuestion(
  websiteId: string,
  question: string,
  options: DashboardQaOptions = {},
): Promise<DashboardAnswerResult> {
  const evidence = await routeDashboardQuestion(question, websiteId, options);
  const key = JSON.stringify({
    websiteId,
    q: evidence.normalized_question,
    intent: evidence.intent,
    scope: evidence.time_scope,
    summary: evidence.summary.summary_24h,
    anomalies: evidence.anomalies.slice(0, 2),
    threat: evidence.threat.total_flagged_sessions,
    tab: evidence.current_tab,
  });
  const cached = qaCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  if (evidence.intent === "insufficient_scope") {
    return buildFallbackDashboardAnswer(evidence.intent, evidence);
  }

  if (!isOpenAiConfigured()) {
    return buildFallbackDashboardAnswer(evidence.intent, evidence);
  }

  const models = [getFastAiModel()];
  let lastError = "ai_generation_failed";
  for (const model of models) {
    try {
      const data = await callAnalystModelWithTimeout(model, evidence);
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

