import type { SiteIntelligenceState } from "@/services/siteStateService";
import type { AnalyticsInsightReport } from "@/services/analyticsInsightEngine";

export type SiteIntelligenceReport = {
  healthScore: number;
  healthLabel: string;
  topPriority: {
    title: string;
    severity: "low" | "medium" | "high" | "none";
    explanation: string;
    recommendedAction: string;
    href?: string;
  };
  momentum: {
    direction: "better" | "stable" | "worse" | "unknown";
    explanation: string;
    href?: string;
  };
  signals: {
    seo: string;
    uptime: string;
    analytics: string;
    reputation: string;
  };
  nextBestActions: string[];
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function healthLabel(score: number): string {
  if (score >= 85) return "Calm, with receipts";
  if (score >= 65) return "Mostly fine, mildly suspicious";
  if (score >= 40) return "Needs attention";
  return "The dashboard is clearing its throat";
}

export function buildSiteIntelligenceReport(input: {
  siteState: SiteIntelligenceState;
  analyticsInsights?: AnalyticsInsightReport | null;
  seoEnabled: boolean;
  canUseReputationPulse: boolean;
  showReputationPulseTeaser: boolean;
}): SiteIntelligenceReport {
  const { siteState } = input;
  const seo = siteState.seo.summary;
  const uptime = siteState.uptime.summary;
  const analytics = siteState.analytics.summary;
  const reputation = siteState.reputation.summary;
  const seoStatus = siteState.seo.status;

  let score = 72;
  if (!uptime) score -= 10;
  if (uptime?.status === "offline") score -= 35;
  if (!seo && input.seoEnabled) score -= seoStatus === "failed" ? 14 : 10;
  if (seo) score -= Math.min(35, seo.broken_pages * 10 + seo.missing_meta * 2 + seo.performance_issues * 2);
  if (!analytics || analytics.traffic_24h === 0) score -= 5;
  if (analytics?.trend === "up") score += 5;
  if (reputation?.flagged_mentions) score -= Math.min(20, reputation.flagged_mentions * 8);
  const healthScore = clampScore(score);

  const topPriority =
    uptime?.status === "offline"
      ? {
          title: "Uptime check failed",
          severity: "high" as const,
          explanation: "Your site may be unreachable. Fix availability before polishing search snippets or celebrating traffic.",
          recommendedAction: "Check uptime",
          href: "#performance",
        }
      : seo && seo.broken_pages > 0
        ? {
            title: "Broken pages need attention",
            severity: "high" as const,
            explanation: "Search engines found locked doors. Visitors hate those too.",
            recommendedAction: "Open SEO Crawl",
            href: "#seo-crawl",
          }
        : seoStatus === "failed"
          ? {
              title: "SEO crawl needs a retry",
              severity: "medium" as const,
              explanation: siteState.seo.errorMessage ?? "The last crawl failed before it saved a usable report.",
              recommendedAction: "Retry SEO crawl",
              href: "#seo-crawl",
            }
          : reputation && reputation.flagged_mentions > 0
          ? {
              title: "Reputation signal needs a look",
              severity: "medium" as const,
              explanation: "A public mention looks important enough to review before it grows legs.",
              recommendedAction: "Open Reputation Pulse",
              href: "#reputation",
            }
          : seo && seo.missing_meta > 0
            ? {
                title: "Search previews need cleanup",
                severity: "medium" as const,
                explanation: "Your pages may be fine, but search results are getting a weaker sales pitch than they deserve.",
                recommendedAction: "Fix metadata first",
                href: "#seo-crawl",
              }
            : !seo && input.seoEnabled
              ? {
                  title: "Run the first SEO crawl",
                  severity: "none" as const,
                  explanation: "The robots have not formed an opinion yet. Give them a clipboard.",
                  recommendedAction: "Run SEO crawl",
                  href: "#seo-crawl",
                }
              : {
                  title: "No obvious fire",
                  severity: "none" as const,
                  explanation: "Nothing is screaming. Suspiciously peaceful, but we will keep watching.",
                  recommendedAction: "Review activity",
                  href: "#traffic",
                };

  const momentum =
    analytics?.trend === "up"
      ? { direction: "better" as const, explanation: input.analyticsInsights?.trafficSummary ?? "Traffic is climbing.", href: "#traffic" }
      : analytics?.trend === "down"
        ? { direction: "worse" as const, explanation: input.analyticsInsights?.trafficSummary ?? "Traffic dipped.", href: "#traffic" }
        : analytics
          ? { direction: "stable" as const, explanation: input.analyticsInsights?.trafficSummary ?? "Traffic is steady.", href: "#traffic" }
          : {
              direction: "unknown" as const,
              explanation: "We need more traffic before calling anything a trend. One data point is a hunch in a tiny hat.",
              href: "#tracker-setup",
            };

  const signals = {
    seo: seo
      ? `${seo.broken_pages} broken, ${seo.missing_meta} metadata, ${seo.performance_issues} performance signals.`
      : seoStatus === "running"
        ? "SEO crawl is running. Fresh data should land shortly."
        : seoStatus === "failed"
          ? siteState.seo.errorMessage ?? "The last SEO crawl failed before a usable report saved."
          : input.seoEnabled
            ? "SEO crawl has not checked in yet."
            : "SEO Crawl is locked on this plan.",
    uptime: uptime
      ? uptime.status === "online"
        ? "Site is online based on the latest stored check."
        : "Latest stored check says the site may be offline."
      : "Monitoring is still warming up.",
    analytics: input.analyticsInsights?.trafficSummary ?? "Analytics has not produced enough signal yet.",
    reputation: reputation
      ? `${reputation.mentions} mention${reputation.mentions === 1 ? "" : "s"}, ${reputation.flagged_mentions} flagged.`
      : input.canUseReputationPulse
        ? "Reputation Pulse needs watch terms or a completed check."
        : input.showReputationPulseTeaser
          ? "Reputation Pulse is available as an upgrade preview."
          : "Reputation Pulse is locked on this plan.",
  };

  const nextBestActions = [
    topPriority.recommendedAction,
    ...(input.analyticsInsights?.recommendedActions ?? []),
  ].filter((item, index, items) => item && items.indexOf(item) === index).slice(0, 4);

  return {
    healthScore,
    healthLabel: healthLabel(healthScore),
    topPriority,
    momentum,
    signals,
    nextBestActions,
  };
}
