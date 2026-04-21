import type { WebsiteAiSummaryInput } from "@/lib/ai/types";
import type { SiteAnalytics } from "@/lib/db/analytics";
import type { ChangeImpactResult } from "@/lib/db/change-impact";
import type { WebsiteInsights } from "@/lib/db/insights";
import type { WebsiteThreatOverview } from "@/lib/db/threats";

type BuildInputArgs = {
  websiteName: string;
  analytics: SiteAnalytics;
  insights: WebsiteInsights;
  threatOverview: WebsiteThreatOverview;
  changeImpacts: ChangeImpactResult[];
};

export function buildWebsiteSummaryInput({
  websiteName,
  analytics,
  insights,
  threatOverview,
  changeImpacts,
}: BuildInputArgs): WebsiteAiSummaryInput {
  return {
    website_name: websiteName,
    summary_24h: {
      sessions: analytics.overview.sessions24h,
      pageviews: analytics.overview.pageviews24h,
      events: analytics.overview.events24h,
      unique_visitors: analytics.overview.uniqueVisitors24h,
      uptime_pct: analytics.uptime.uptimePct24h,
      uptime_checks: analytics.uptime.checks24h,
    },
    anomalies: insights.anomalies.slice(0, 5).map((a) => ({
      date: a.date,
      metric: a.metric_type,
      type: a.anomaly_type,
      percent_change: a.percent_change,
    })),
    vitals: analytics.vitalAverages.slice(0, 5).map((v) => ({
      metric: v.metric,
      average: v.average,
      samples: v.samples,
    })),
    threats: {
      total_flagged_sessions: threatOverview.total_flagged_sessions,
      high_risk_sessions: threatOverview.high_risk_sessions,
      medium_risk_sessions: threatOverview.medium_risk_sessions,
      top_risk_reasons: threatOverview.top_risk_reasons.slice(0, 4),
    },
    uptime: {
      has_checks: analytics.uptime.hasChecks24h,
      checks_24h: analytics.uptime.checks24h,
      checks_up_24h: analytics.uptime.checksUp24h,
      uptime_pct_24h: analytics.uptime.uptimePct24h,
    },
    top_pages: analytics.topPages.slice(0, 5),
    recent_changes: changeImpacts.slice(0, 4).map((c) => ({
      title: c.title,
      created_at: c.created_at,
      summary: c.summary,
      flags: c.flags.slice(0, 4),
    })),
    deterministic_signals: {
      insight_summary: insights.summary_text,
      key_points: insights.key_points.slice(0, 5),
      detected_flags: insights.detected_flags.slice(0, 8),
    },
  };
}
