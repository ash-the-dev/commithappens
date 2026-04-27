import type { SiteAnalytics } from "@/lib/db/analytics";
import { getSiteAnalytics } from "@/lib/db/analytics";
import type { ChangeImpactResult } from "@/lib/db/change-impact";
import { getWebsiteChangeImpacts } from "@/lib/db/change-impact";
import type { WebsiteInsights } from "@/lib/db/insights";
import { getWebsiteInsights } from "@/lib/db/insights";
import type { WebsiteThreatLeaderboard, WebsiteThreatOverview } from "@/lib/db/threats";
import {
  getWebsiteThreatLeaderboard,
  getWebsiteThreatOverview,
} from "@/lib/db/threats";
import { getPool } from "@/lib/db/pool";

export type AlertCategory =
  | "uptime"
  | "performance"
  | "threat"
  | "traffic_anomaly"
  | "conversion"
  | "change_impact"
  | "monitoring_gap";

export type AlertSeverity = "critical" | "high" | "medium" | "low";

export type WebsiteAlert = {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  summary: string;
  evidence_points: string[];
  recommended_actions: string[];
  detected_at: string;
  source_label: "deterministic";
};

export type AlertPlaybook = {
  category: AlertCategory;
  title: string;
  steps: string[];
  priority_label: AlertSeverity;
};

export type WebsiteAlertCenterData = {
  website_id: string;
  website_name: string;
  generated_at: string;
  alerts: WebsiteAlert[];
  playbooks: AlertPlaybook[];
};

const ALERT_RULES = {
  uptimeCriticalFailures24h: 3,
  uptimeHighFailures24h: 1,
  lcpHighMs: 2500,
  clsHigh: 0.1,
  inpHighMs: 200,
  missingVitalsBusySessions24h: 25,
  anomalyHighPct: 80,
  anomalyMediumPct: 40,
  threatHighRiskSessionsHigh: 3,
  threatFlaggedSessionsMedium: 8,
  conversionDropHighPct: -25,
  conversionDropMediumPct: -15,
} as const;

function rankSeverity(severity: AlertSeverity): number {
  if (severity === "critical") return 4;
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function makeId(category: AlertCategory, title: string): string {
  return `${category}:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function vitalsAlert(
  analytics: SiteAnalytics,
  detectedAt: string,
): WebsiteAlert | null {
  const lcp = analytics.vitalAverages.find((v) => v.metric.toUpperCase() === "LCP")?.average ?? null;
  const cls = analytics.vitalAverages.find((v) => v.metric.toUpperCase() === "CLS")?.average ?? null;
  const inp = analytics.vitalAverages.find((v) => v.metric.toUpperCase() === "INP")?.average ?? null;
  const problematic: string[] = [];
  if (lcp != null && lcp > ALERT_RULES.lcpHighMs) problematic.push(`LCP ${Math.round(lcp)}ms`);
  if (cls != null && cls > ALERT_RULES.clsHigh) problematic.push(`CLS ${cls.toFixed(3)}`);
  if (inp != null && inp > ALERT_RULES.inpHighMs) problematic.push(`INP ${Math.round(inp)}ms`);

  if (problematic.length === 0) return null;
  const severity: AlertSeverity = problematic.length >= 2 ? "high" : "medium";
  return {
    id: makeId("performance", "Core Web Vitals regression"),
    category: "performance",
    severity,
    title: "Core Web Vitals regression",
    summary: "Performance metrics are above target thresholds on recent traffic.",
    evidence_points: [
      `Problematic metrics: ${problematic.join(", ")}.`,
      `Top pages: ${analytics.topPages.slice(0, 2).map((p) => p.path).join(", ") || "none"}.`,
    ],
    recommended_actions: [
      "Profile top-traffic affected pages for render-blocking work and layout shifts.",
      "Compare vitals movement with recent deploy/change windows.",
    ],
    detected_at: detectedAt,
    source_label: "deterministic",
  };
}

type DetectionInputs = {
  websiteId: string;
  analytics: SiteAnalytics;
  insights: WebsiteInsights;
  threatOverview: WebsiteThreatOverview;
  threatLeaderboard: WebsiteThreatLeaderboard;
  changeImpacts: ChangeImpactResult[];
  detectedAt: string;
};

export function detectWebsiteAlertsFromInputs(input: DetectionInputs): WebsiteAlert[] {
  const alerts: WebsiteAlert[] = [];
  const { analytics, insights, threatOverview, threatLeaderboard, changeImpacts, detectedAt } =
    input;

  if (!analytics.uptime.hasChecks24h) {
    alerts.push({
      id: makeId("monitoring_gap", "Uptime checks missing"),
      category: "monitoring_gap",
      severity: "high",
      title: "Uptime checks missing",
      summary: "No uptime checks were recorded in the last 24 hours.",
      evidence_points: ["Uptime logs have zero checks in the latest 24-hour window."],
      recommended_actions: [
        "Create at least one enabled uptime check for the primary production URL.",
        "Validate scheduler and secret configuration for uptime runner execution.",
      ],
      detected_at: detectedAt,
      source_label: "deterministic",
    });
  } else {
    const failures = analytics.uptime.checks24h - analytics.uptime.checksUp24h;
    if (failures >= ALERT_RULES.uptimeHighFailures24h) {
      const severity: AlertSeverity =
        failures >= ALERT_RULES.uptimeCriticalFailures24h ? "critical" : "high";
      alerts.push({
        id: makeId("uptime", "Uptime failures detected"),
        category: "uptime",
        severity,
        title: "Uptime failures detected",
        summary: "Availability issues were recorded in the most recent monitoring window.",
        evidence_points: [
          `${failures} failed checks out of ${analytics.uptime.checks24h} checks in 24h.`,
          `Current uptime: ${analytics.uptime.uptimePct24h.toFixed(2)}%.`,
        ],
        recommended_actions: [
          "Inspect failure timestamps and correlate with recent deploy/change activity.",
          "Review failing endpoint response logs and infrastructure health around incident windows.",
        ],
        detected_at: detectedAt,
        source_label: "deterministic",
      });
    }
  }

  const perf = vitalsAlert(analytics, detectedAt);
  if (perf) alerts.push(perf);

  if (
    analytics.vitalAverages.length === 0 &&
    analytics.overview.sessions24h >= ALERT_RULES.missingVitalsBusySessions24h
  ) {
    alerts.push({
      id: makeId("monitoring_gap", "Vitals coverage missing on active traffic"),
      category: "monitoring_gap",
      severity: "medium",
      title: "Vitals coverage missing on active traffic",
      summary: "Traffic is active but no web vitals were captured recently.",
      evidence_points: [
        `${analytics.overview.sessions24h} sessions in 24h with zero vitals samples in 7d.`,
      ],
      recommended_actions: [
        "Confirm tracker web-vitals capture is present on production pages.",
        "Verify ingestion pipeline writes to web_vitals for current site key.",
      ],
      detected_at: detectedAt,
      source_label: "deterministic",
    });
  }

  const latestAnomaly = insights.anomalies[0];
  if (latestAnomaly && Math.abs(latestAnomaly.percent_change) >= ALERT_RULES.anomalyMediumPct) {
    const severity: AlertSeverity =
      Math.abs(latestAnomaly.percent_change) >= ALERT_RULES.anomalyHighPct ? "high" : "medium";
    alerts.push({
      id: makeId("traffic_anomaly", "Significant traffic anomaly"),
      category: "traffic_anomaly",
      severity,
      title: "Significant traffic anomaly",
      summary: `Recent ${latestAnomaly.anomaly_type} detected in ${latestAnomaly.metric_type}.`,
      evidence_points: [
        `${latestAnomaly.date}: ${latestAnomaly.metric_type} ${latestAnomaly.percent_change > 0 ? "+" : ""}${latestAnomaly.percent_change.toFixed(1)}% vs baseline.`,
      ],
      recommended_actions: [
        "Review top page/event shifts and source quality for the anomaly day.",
        "Check for deploy, uptime, or threat changes aligned with the anomaly window.",
      ],
      detected_at: detectedAt,
      source_label: "deterministic",
    });
  }

  if (
    threatOverview.high_risk_sessions >= ALERT_RULES.threatHighRiskSessionsHigh ||
    threatOverview.total_flagged_sessions >= ALERT_RULES.threatFlaggedSessionsMedium
  ) {
    const severity: AlertSeverity =
      threatOverview.high_risk_sessions >= ALERT_RULES.threatHighRiskSessionsHigh ? "high" : "medium";
    alerts.push({
      id: makeId("threat", "Suspicious activity cluster detected"),
      category: "threat",
      severity,
      title: "Suspicious activity cluster detected",
      summary: "Rule-based threat signals indicate concentrated suspicious session behavior.",
      evidence_points: [
        `${threatOverview.total_flagged_sessions} flagged sessions, ${threatOverview.high_risk_sessions} high-risk.`,
        `Top reasons: ${threatOverview.top_risk_reasons.slice(0, 3).join(", ") || "none"}.`,
      ],
      recommended_actions: [
        "Inspect flagged sessions and repeated reason-code patterns first.",
        `Review risky paths/events: ${threatLeaderboard.risky_paths
          .slice(0, 2)
          .map((p) => p.path)
          .join(", ") || "none"}.`,
      ],
      detected_at: detectedAt,
      source_label: "deterministic",
    });
  }

  const latestChange = changeImpacts[0];
  if (latestChange) {
    const convPct = latestChange.metrics.conversions_percent_change;
    if (convPct != null && convPct <= ALERT_RULES.conversionDropMediumPct) {
      const severity: AlertSeverity =
        convPct <= ALERT_RULES.conversionDropHighPct ? "high" : "medium";
      alerts.push({
        id: makeId("conversion", "Conversion decline after recent change"),
        category: "conversion",
        severity,
        title: "Conversion decline after recent change",
        summary: "Conversion events dropped in the latest measured change-impact window.",
        evidence_points: [
          `Latest change: ${latestChange.title}.`,
          `Conversion delta: ${convPct.toFixed(1)}%.`,
        ],
        recommended_actions: [
          "Review funnel-critical paths and conversion event instrumentation after latest change.",
          "Compare conversion movement with source quality and page performance shifts.",
        ],
        detected_at: detectedAt,
        source_label: "deterministic",
      });
    }

    if (
      latestChange.flags.includes("uptime_impact") ||
      latestChange.flags.includes("risk_change") ||
      latestChange.flags.includes("traffic_drop")
    ) {
      alerts.push({
        id: makeId("change_impact", "Recent change window shows risk signals"),
        category: "change_impact",
        severity: latestChange.flags.includes("uptime_impact") ? "high" : "medium",
        title: "Recent change window shows risk signals",
        summary: "Post-change metrics include signals that warrant follow-up validation.",
        evidence_points: [
          `Latest change: ${latestChange.title}.`,
          `Impact flags: ${latestChange.flags.join(", ")}.`,
        ],
        recommended_actions: [
          "Run post-change validation checks on affected pages and events.",
          "Confirm rollback/mitigation readiness if negative signals continue.",
        ],
        detected_at: detectedAt,
        source_label: "deterministic",
      });
    }
  }

  alerts.sort((a, b) => rankSeverity(b.severity) - rankSeverity(a.severity));
  return alerts;
}

export function buildWebsitePlaybooks(
  websiteId: string,
  alerts: WebsiteAlert[],
): AlertPlaybook[] {
  const seen = new Set<AlertCategory>();
  const playbooks: AlertPlaybook[] = [];
  for (const alert of alerts) {
    if (seen.has(alert.category)) continue;
    seen.add(alert.category);
    playbooks.push({
      category: alert.category,
      title: `${alert.category.replace(/_/g, " ")} playbook`,
      priority_label: alert.severity,
      steps: alert.recommended_actions.slice(0, 3),
    });
  }
  if (playbooks.length === 0) {
    playbooks.push({
      category: "monitoring_gap",
      title: "Stable-state operating playbook",
      priority_label: "low",
      steps: [
        `No active alerts for website ${websiteId}.`,
        "Review recommendations for highest-opportunity optimizations.",
        "Keep change logs updated to strengthen future impact correlation.",
      ],
    });
  }
  return playbooks;
}

type PreloadedSignals = {
  websiteName?: string;
  analytics?: SiteAnalytics;
  insights?: WebsiteInsights;
  threatOverview?: WebsiteThreatOverview;
  threatLeaderboard?: WebsiteThreatLeaderboard;
  changeImpacts?: ChangeImpactResult[];
};

export async function detectWebsiteAlerts(
  websiteId: string,
  preloaded?: PreloadedSignals,
): Promise<WebsiteAlert[]> {
  const [analytics, threatOverview, changeImpacts] = await Promise.all([
    preloaded?.analytics ?? getSiteAnalytics(websiteId),
    preloaded?.threatOverview ?? getWebsiteThreatOverview(websiteId),
    preloaded?.changeImpacts ?? getWebsiteChangeImpacts(websiteId),
  ]);
  const [insights, threatLeaderboard] = await Promise.all([
    preloaded?.insights ?? getWebsiteInsights(websiteId, threatOverview),
    preloaded?.threatLeaderboard ?? getWebsiteThreatLeaderboard(websiteId, threatOverview),
  ]);
  return detectWebsiteAlertsFromInputs({
    websiteId,
    analytics,
    insights,
    threatOverview,
    threatLeaderboard,
    changeImpacts,
    detectedAt: new Date().toISOString(),
  });
}

export async function getWebsiteAlertCenterData(
  websiteId: string,
  preloaded?: PreloadedSignals,
): Promise<WebsiteAlertCenterData> {
  const pool = getPool();
  const [nameRes, alerts] = await Promise.all([
    preloaded?.websiteName
      ? Promise.resolve({ rows: [{ name: preloaded.websiteName }] })
      : pool.query<{ name: string }>(`SELECT name FROM websites WHERE id = $1::uuid LIMIT 1`, [
          websiteId,
        ]),
    detectWebsiteAlerts(websiteId, preloaded),
  ]);
  return {
    website_id: websiteId,
    website_name: nameRes.rows[0]?.name ?? "Website",
    generated_at: new Date().toISOString(),
    alerts,
    playbooks: buildWebsitePlaybooks(websiteId, alerts),
  };
}

export function serializeAlertForNotification(alert: WebsiteAlert): {
  title: string;
  severity: AlertSeverity;
  category: AlertCategory;
  body: string;
  metadata: Record<string, unknown>;
} {
  return {
    title: alert.title,
    severity: alert.severity,
    category: alert.category,
    body: alert.summary,
    metadata: {
      evidence_points: alert.evidence_points,
      recommended_actions: alert.recommended_actions,
      detected_at: alert.detected_at,
      source_label: alert.source_label,
    },
  };
}

export { ALERT_RULES };

