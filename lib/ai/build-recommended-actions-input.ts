import "server-only";
import type {
  RecommendationCandidate,
  RecommendationPriority,
  WebsiteRecommendationsInput,
} from "@/lib/ai/types";
import { getSiteAnalytics } from "@/lib/db/analytics";
import { getWebsiteInsights } from "@/lib/db/insights";
import { getWebsiteThreatLeaderboard, getWebsiteThreatOverview } from "@/lib/db/threats";
import { getWebsiteChangeImpacts } from "@/lib/db/change-impact";
import { getPool } from "@/lib/db/pool";

const RECOMMENDATION_RULES = {
  uptimeCriticalPct: 99,
  lcpHighMs: 2500,
  clsHigh: 0.1,
  inpHighMs: 200,
  trafficAnomalyCountHigh: 2,
  highRiskSessionsHigh: 2,
  flaggedSessionsHigh: 6,
  conversionDropHighPct: -20,
} as const;

function priorityRank(priority: RecommendationPriority): number {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function highestPriority(candidates: RecommendationCandidate[]): RecommendationPriority {
  if (candidates.some((c) => c.priority === "critical")) return "critical";
  if (candidates.some((c) => c.priority === "high")) return "high";
  if (candidates.some((c) => c.priority === "medium")) return "medium";
  return "low";
}

export function prioritizeWebsiteRecommendations(
  facts: Omit<WebsiteRecommendationsInput, "recommended_priority_context">,
): RecommendationCandidate[] {
  const out: RecommendationCandidate[] = [];

  if (!facts.uptime_signals.has_checks) {
    out.push({
      kind: "issue",
      category: "uptime",
      priority: "high",
      title: "Uptime checks are not configured",
      rationale: "Without uptime checks, outages and regressions can go undetected.",
      suggested_action: "Enable at least one uptime check for the primary production URL.",
    });
  } else if (facts.uptime_signals.uptime_pct_24h < RECOMMENDATION_RULES.uptimeCriticalPct) {
    out.push({
      kind: "issue",
      category: "uptime",
      priority: "critical",
      title: "Uptime degraded in the last 24h",
      rationale: `${facts.uptime_signals.failed_checks_24h} failed check(s) detected.`,
      suggested_action:
        "Review recent deployments and endpoint health logs tied to the failed check window.",
    });
  }

  if (facts.performance_signals.problematic_metrics.length > 0) {
    out.push({
      kind: "issue",
      category: "performance",
      priority: "high",
      title: "Core Web Vitals need attention",
      rationale: `Problematic metrics: ${facts.performance_signals.problematic_metrics.join(", ")}.`,
      suggested_action:
        "Audit the highest-traffic affected pages for render-blocking scripts and layout shifts.",
    });
  }

  if (
    facts.threat_signals.high_risk_sessions >= RECOMMENDATION_RULES.highRiskSessionsHigh ||
    facts.threat_signals.flagged_sessions >= RECOMMENDATION_RULES.flaggedSessionsHigh
  ) {
    out.push({
      kind: "issue",
      category: "threat",
      priority: "high",
      title: "Suspicious session activity increased",
      rationale: `${facts.threat_signals.flagged_sessions} flagged sessions, ${facts.threat_signals.high_risk_sessions} high-risk.`,
      suggested_action:
        "Inspect top flagged paths/events and review session patterns for automation or abuse.",
    });
  }

  if (
    facts.conversion_signals.has_conversion_data &&
    facts.conversion_signals.conversion_change_pct != null &&
    facts.conversion_signals.conversion_change_pct <= RECOMMENDATION_RULES.conversionDropHighPct
  ) {
    out.push({
      kind: "issue",
      category: "conversion",
      priority: "high",
      title: "Conversion rate likely declined after recent changes",
      rationale: `Conversion delta ${facts.conversion_signals.conversion_change_pct.toFixed(1)}%.`,
      suggested_action:
        "Review funnel steps and event instrumentation on recently changed pages.",
    });
  }

  if (facts.summary_signals.anomalies_count >= RECOMMENDATION_RULES.trafficAnomalyCountHigh) {
    out.push({
      kind: "issue",
      category: "traffic",
      priority: "medium",
      title: "Multiple recent anomalies detected",
      rationale: `${facts.summary_signals.anomalies_count} notable spike/drop signals were detected.`,
      suggested_action:
        "Correlate anomaly dates with source quality, deploy history, and event mix changes.",
    });
  }

  if (facts.change_signals.latest_change_title) {
    out.push({
      kind: "opportunity",
      category: "change_review",
      priority: "medium",
      title: "Latest change impact is available for review",
      rationale: `Recent change: ${facts.change_signals.latest_change_title}.`,
      suggested_action:
        "Validate whether the change aligned with intended KPI movement and update rollout notes.",
    });
  }

  if (out.length === 0) {
    out.push({
      kind: "opportunity",
      category: "traffic",
      priority: "low",
      title: "No urgent issues detected",
      rationale: "Current signals are relatively stable.",
      suggested_action:
        "Focus on incremental experiments on top pages and monitor conversion-quality trends.",
    });
  }

  out.sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
  return out;
}

export async function buildRecommendedActionsInput(
  websiteId: string,
): Promise<WebsiteRecommendationsInput> {
  const pool = getPool();
  const [site, analytics, threatOverview, threatLeaderboard, changeImpacts] = await Promise.all([
    pool.query<{ name: string }>(`SELECT name FROM websites WHERE id = $1::uuid LIMIT 1`, [websiteId]),
    getSiteAnalytics(websiteId),
    getWebsiteThreatOverview(websiteId),
    getWebsiteThreatLeaderboard(websiteId),
    getWebsiteChangeImpacts(websiteId),
  ]);
  const insights = await getWebsiteInsights(websiteId, threatOverview);

  const lcp = analytics.vitalAverages.find((v) => v.metric.toUpperCase() === "LCP")?.average ?? null;
  const cls = analytics.vitalAverages.find((v) => v.metric.toUpperCase() === "CLS")?.average ?? null;
  const inp = analytics.vitalAverages.find((v) => v.metric.toUpperCase() === "INP")?.average ?? null;

  const problematicMetrics: string[] = [];
  if (lcp != null && lcp > RECOMMENDATION_RULES.lcpHighMs) problematicMetrics.push("LCP");
  if (cls != null && cls > RECOMMENDATION_RULES.clsHigh) problematicMetrics.push("CLS");
  if (inp != null && inp > RECOMMENDATION_RULES.inpHighMs) problematicMetrics.push("INP");

  const latestChange = changeImpacts[0] ?? null;
  const conversionChange =
    latestChange?.metrics.conversions_percent_change != null
      ? latestChange.metrics.conversions_percent_change
      : null;
  const hasConversionData = latestChange?.metrics.conversions_before != null;

  const base: Omit<WebsiteRecommendationsInput, "recommended_priority_context"> = {
    website_name: site.rows[0]?.name ?? "Website",
    summary_signals: {
      sessions_24h: analytics.overview.sessions24h,
      pageviews_24h: analytics.overview.pageviews24h,
      events_24h: analytics.overview.events24h,
      unique_visitors_24h: analytics.overview.uniqueVisitors24h,
      anomalies_count: insights.anomalies.length,
    },
    performance_signals: {
      lcp_avg: lcp,
      cls_avg: cls,
      inp_avg: inp,
      problematic_metrics: problematicMetrics,
      top_affected_pages: analytics.topPages.slice(0, 3).map((p) => p.path),
    },
    uptime_signals: {
      has_checks: analytics.uptime.hasChecks24h,
      uptime_pct_24h: analytics.uptime.uptimePct24h,
      failed_checks_24h: analytics.uptime.checks24h - analytics.uptime.checksUp24h,
    },
    threat_signals: {
      flagged_sessions: threatOverview.total_flagged_sessions,
      high_risk_sessions: threatOverview.high_risk_sessions,
      top_reasons: threatOverview.top_risk_reasons.slice(0, 4),
      risky_paths: threatLeaderboard.risky_paths.slice(0, 4).map((p) => p.path),
    },
    change_signals: {
      latest_change_title: latestChange?.title ?? null,
      latest_change_flags: latestChange?.flags ?? [],
      latest_change_summary: latestChange?.summary ?? null,
    },
    conversion_signals: {
      has_conversion_data: hasConversionData ?? false,
      conversion_change_pct: conversionChange,
    },
    strongest_issues: [
      ...insights.key_points.slice(0, 2),
      ...threatOverview.top_risk_reasons.slice(0, 2).map((r) => `Threat reason: ${r}`),
    ].slice(0, 5),
    strongest_opportunities: analytics.topPages
      .slice(0, 3)
      .map((p) => `Top page opportunity: ${p.path}`),
  };

  const candidates = prioritizeWebsiteRecommendations(base);
  return {
    ...base,
    recommended_priority_context: {
      highest_priority: highestPriority(candidates),
      candidates,
    },
  };
}
