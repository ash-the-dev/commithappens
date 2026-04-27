import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getRequestOrigin } from "@/lib/app-url";
import { authOptions } from "@/lib/auth/options";
import { SiteAnalyticsCharts } from "@/components/dashboard/SiteAnalyticsCharts";
import { SiteSeoHealth } from "@/components/dashboard/SiteSeoHealth";
import { getSiteAnalytics, getSiteLiveActivity } from "@/lib/db/analytics";
import { DeleteSiteButton } from "@/components/dashboard/DeleteSiteButton";
import { SiteInsightsCard } from "@/components/dashboard/SiteInsightsCard";
import { getWebsiteForUser } from "@/lib/db/websites";
import { emptyWebsiteInsightsForFreePlan, getWebsiteInsights } from "@/lib/db/insights";
import { ThreatOverviewCard } from "@/components/dashboard/ThreatOverviewCard";
import { FlaggedActivityCard } from "@/components/dashboard/FlaggedActivityCard";
import { ChangeImpactCard } from "@/components/dashboard/ChangeImpactCard";
import { RecommendationsCard } from "@/components/dashboard/RecommendationsCard";
import { LazyAiSummaryCard } from "@/components/dashboard/LazyAiSummaryCard";
import { LazySpikeExplanationCard } from "@/components/dashboard/LazySpikeExplanationCard";
import { LazyChangeImpactNarrativeCard } from "@/components/dashboard/LazyChangeImpactNarrativeCard";
import { AnalystChatCard } from "@/components/dashboard/AnalystChatCard";
import { AlertCenterCard } from "@/components/dashboard/AlertCenterCard";
import { PlaybookCard } from "@/components/dashboard/PlaybookCard";
import { NotificationCenterCard } from "@/components/dashboard/NotificationCenterCard";
import { CaseWorkbenchCard } from "@/components/dashboard/CaseWorkbenchCard";
import {
  emptyWebsiteThreatLeaderboard,
  emptyWebsiteThreatOverview,
  getWebsiteFlaggedActivity,
  getWebsiteThreatLeaderboard,
  getWebsiteThreatOverview,
} from "@/lib/db/threats";
import { getWebsiteChangeImpacts } from "@/lib/db/change-impact";
import { prioritizeWebsiteRecommendations } from "@/lib/ai/build-recommended-actions-input";
import { buildFallbackSpikeExplanation } from "@/lib/ai/generate-spike-explanation";
import { buildFallbackChangeImpactNarrative } from "@/lib/ai/generate-change-impact-narrative";
import { buildFallbackWebsiteRecommendations } from "@/lib/ai/generate-website-recommendations";
import type {
  ChangeImpactNarrativeInput,
  RecommendationPriority,
  SpikeExplanationInput,
  WebsiteRecommendationsInput,
} from "@/lib/ai/types";
import type { WebsiteAlertCenterData } from "@/lib/db/alerts";
import { getWebsiteAlertCenterData } from "@/lib/db/alerts";
import { getWebsiteNotifications } from "@/lib/db/notifications";
import { getCaseWorkbenchData } from "@/lib/db/cases";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { ResponseCodeDashboardCard } from "@/components/dashboard/ResponseCodeDashboardCard";
import { RefreshPageDataButton } from "@/components/dashboard/RefreshPageDataButton";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";
import { getBillingAccess } from "@/lib/billing/access";
import { canUseFeature, getPlanLimit, shouldShowFeature } from "@/lib/entitlements";
import { UptimeMonitorCard } from "@/components/dashboard/UptimeMonitorCard";
import { getWebsiteUptimeHistory, getWebsiteUptimeSnapshot } from "@/lib/db/uptime";
import { SeoCrawlIntelligenceSection } from "@/components/dashboard/SeoCrawlIntelligenceSection";
import {
  getLatestSeoCrawlRun,
  getSeoCrawlOnPageBreakdown,
  getSeoCrawlRunHistory,
  getTopCrawlIssues,
} from "@/lib/db/seo-crawl-intelligence";
import { buildSiteTrendsPayload } from "@/lib/dashboard/site-trends";
import { SeoReportRefreshButton } from "@/components/dashboard/SeoReportRefreshButton";
import { AiSeoRecommendationsCard } from "@/components/dashboard/AiSeoRecommendationsCard";
import { getMetricExplanation } from "@/lib/seo/crawl/explanations";
import {
  SiteCommandCenterDashboard,
  type CommandCenterBriefingCard,
  type CommandCenterTab,
} from "@/components/dashboard/SiteCommandCenterDashboard";
import { ReputationPulsePanel } from "@/components/dashboard/ReputationPulsePanel";
import { ReputationPulseTeaser } from "@/components/dashboard/ReputationPulseTeaser";
import { SiteSignalSummaryCard } from "@/components/dashboard/SiteSignalSummaryCard";
import { getSocialMentionsNeedingAttention, getSocialWatchTermsForSite } from "@/lib/social/socialMentionService";
import { buildOverviewBriefing, type OverviewBriefing } from "@/services/overviewBriefingService";
import { getSiteIntelligenceState } from "@/services/siteStateService";
import { buildAnalyticsInsightReport } from "@/services/analyticsInsightEngine";
import { buildSiteIntelligenceReport } from "@/services/siteIntelligenceEngine";

type Props = { params: Promise<{ id: string }> };

function compactDate(iso: string | null | undefined): string {
  if (!iso) return "Not run yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not run yet";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function highestRecommendationPriority(candidates: WebsiteRecommendationsInput["recommended_priority_context"]["candidates"]): RecommendationPriority {
  if (candidates.some((c) => c.priority === "critical")) return "critical";
  if (candidates.some((c) => c.priority === "high")) return "high";
  if (candidates.some((c) => c.priority === "medium")) return "medium";
  return "low";
}

function changeDirectionFlag(metrics: ChangeImpactNarrativeInput["metric_deltas"]): "positive" | "negative" | "mixed" | "neutral" {
  const sessionMoved = Math.abs(metrics.sessions_percent_change) >= 10;
  const pageviewMoved = Math.abs(metrics.pageviews_percent_change) >= 10;
  if (!sessionMoved && !pageviewMoved) return "neutral";
  const positives = [metrics.sessions_percent_change, metrics.pageviews_percent_change].filter((v) => v >= 10).length;
  const negatives = [metrics.sessions_percent_change, metrics.pageviews_percent_change].filter((v) => v <= -10).length;
  if (positives > 0 && negatives > 0) return "mixed";
  if (positives > 0) return "positive";
  if (negatives > 0) return "negative";
  return "neutral";
}

function relativeTime(iso: string | null | undefined, fallback = "Not run yet"): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return compactDate(iso);
}

function briefingTimestamp(iso: string | null | undefined, fallback = "Not checked yet"): string {
  if (!iso) return fallback;
  return relativeTime(iso, fallback);
}

function tabFromHref(href: string | undefined, fallback: string): string {
  return href?.startsWith("#") ? href.slice(1) : fallback;
}

function toneForMonitoring(status: OverviewBriefing["monitoringStatus"]["status"]): CommandCenterBriefingCard["statusTone"] {
  if (status === "online") return "good";
  if (status === "offline") return "bad";
  return "neutral";
}

function toneForMomentum(trend: OverviewBriefing["siteMomentum"]["trend"]): CommandCenterBriefingCard["statusTone"] {
  if (trend === "better") return "good";
  if (trend === "worse") return "bad";
  return "neutral";
}

function toneForSeverity(severity: "low" | "medium" | "high" | "none"): CommandCenterBriefingCard["statusTone"] {
  if (severity === "high") return "bad";
  if (severity === "medium") return "warn";
  if (severity === "low") return "neutral";
  return "good";
}

export default async function SiteDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }
  const site = await getWebsiteForUser(id, session.user.id);
  if (!site) {
    notFound();
  }
  const billing = await getBillingAccess(session.user.id, session.user.email);
  const seoEnabled = canUseFeature(billing.accountKind, "seoCrawl");
  const canUseIntelligence = canUseFeature(billing.accountKind, "dashboardIntelligence");
  const canUseReputationPulse = canUseFeature(billing.accountKind, "reputationPulse");
  const showReputationPulseTeaser = shouldShowFeature(billing.accountKind, "reputationPulseTeaser");

  const [
    analytics,
    liveActivity,
    uptimeSnapshot,
    uptimeHistory,
    crawlSnapshot,
    topCrawlIssues,
    crawlRunHistory,
    onPageForReport,
    socialMentionsNeedingAttention,
    socialWatchTerms,
  ] = await Promise.all([
    getSiteAnalytics(site.id),
    getSiteLiveActivity(site.id, 25),
    getWebsiteUptimeSnapshot(site.id),
    getWebsiteUptimeHistory(site.id, 50).catch(() => []),
    getLatestSeoCrawlRun(site.id).catch(() => null),
    getTopCrawlIssues(site.id, 3).catch(() => []),
    getSeoCrawlRunHistory(site.id, 18).catch(() => []),
    getSeoCrawlOnPageBreakdown(site.id).catch(() => null),
    canUseReputationPulse ? getSocialMentionsNeedingAttention(site.id, 5).catch(() => []) : Promise.resolve([]),
    canUseReputationPulse ? getSocialWatchTermsForSite(site.id).catch(() => []) : Promise.resolve([]),
  ]);
  const uptimeCardHistory = uptimeHistory.slice(0, 50);
  const siteTrendsInitial = buildSiteTrendsPayload(crawlRunHistory, uptimeHistory);
  const socialAttentionMentions = socialMentionsNeedingAttention;
  const lastSeoLabel = relativeTime(crawlSnapshot?.created_at, "No SEO crawl yet");
  const lastUptimeLabel = relativeTime(uptimeSnapshot?.lastCheckedAt, "No uptime check yet");
  const dashboardLoadedLabel = relativeTime(siteTrendsInitial.generatedAt, "Loaded just now");
  const siteState = await getSiteIntelligenceState(site.id);
  const analyticsInsights = buildAnalyticsInsightReport({
    analytics,
    summary: siteState.analytics.summary,
  });
  const siteIntelligence = buildSiteIntelligenceReport({
    siteState,
    analyticsInsights,
    seoEnabled,
    canUseReputationPulse,
    showReputationPulseTeaser,
  });

  let threatOverview = emptyWebsiteThreatOverview();
  let changeImpacts: Awaited<ReturnType<typeof getWebsiteChangeImpacts>> = [];
  let insights = emptyWebsiteInsightsForFreePlan();
  let flaggedActivity: Awaited<ReturnType<typeof getWebsiteFlaggedActivity>> = [];
  let threatLeaderboard = emptyWebsiteThreatLeaderboard();
  let spikeExplanation: ReturnType<typeof buildFallbackSpikeExplanation> | null = null;
  let changeNarrative: ReturnType<typeof buildFallbackChangeImpactNarrative> | null = null;
  let recommendations: ReturnType<typeof buildFallbackWebsiteRecommendations> | null = null;
  let alertCenter: WebsiteAlertCenterData = {
    website_id: site.id,
    website_name: site.name,
    generated_at: new Date().toISOString(),
    alerts: [],
    playbooks: [],
  };
  let notifications: Awaited<ReturnType<typeof getWebsiteNotifications>> = [];
  let caseWorkbench: Awaited<ReturnType<typeof getCaseWorkbenchData>> = {
    cases: [],
    notes_by_case_id: {},
  };

  if (canUseIntelligence) {
    [threatOverview, changeImpacts] = await Promise.all([
      getWebsiteThreatOverview(site.id),
      getWebsiteChangeImpacts(site.id),
    ]);
    [insights, flaggedActivity, threatLeaderboard] = await Promise.all([
      getWebsiteInsights(site.id, threatOverview),
      getWebsiteFlaggedActivity(site.id, 10, threatOverview),
      getWebsiteThreatLeaderboard(site.id, threatOverview),
    ]);
    const lcp = analytics.vitalAverages.find((v) => v.metric.toUpperCase() === "LCP")?.average ?? null;
    const cls = analytics.vitalAverages.find((v) => v.metric.toUpperCase() === "CLS")?.average ?? null;
    const inp = analytics.vitalAverages.find((v) => v.metric.toUpperCase() === "INP")?.average ?? null;
    const problematicMetrics = [
      lcp != null && lcp > 2500 ? "LCP" : null,
      cls != null && cls > 0.1 ? "CLS" : null,
      inp != null && inp > 200 ? "INP" : null,
    ].filter((metric): metric is string => Boolean(metric));
    const latestChange = changeImpacts[0] ?? null;
    const latestAnomaly = insights.anomalies[0] ?? null;
    if (latestAnomaly) {
      const factors = insights.latest_spike_explanation?.factors ?? [];
      const spikeInput: SpikeExplanationInput = {
        website_name: site.name,
        target_date: latestAnomaly.date,
        anomaly_type: latestAnomaly.anomaly_type,
        metric_focus: latestAnomaly.metric_type,
        current_metrics: {
          sessions: latestAnomaly.metric_type === "sessions" ? latestAnomaly.actual_value : 0,
          pageviews: latestAnomaly.metric_type === "pageviews" ? latestAnomaly.actual_value : 0,
          events: latestAnomaly.metric_type === "events" ? latestAnomaly.actual_value : 0,
          conversions: null,
        },
        baseline_metrics: {
          sessions: latestAnomaly.metric_type === "sessions" ? latestAnomaly.baseline_value : 0,
          pageviews: latestAnomaly.metric_type === "pageviews" ? latestAnomaly.baseline_value : 0,
          events: latestAnomaly.metric_type === "events" ? latestAnomaly.baseline_value : 0,
          conversions: null,
        },
        metric_deltas: {
          sessions_pct: latestAnomaly.metric_type === "sessions" ? latestAnomaly.percent_change : 0,
          pageviews_pct: latestAnomaly.metric_type === "pageviews" ? latestAnomaly.percent_change : 0,
          events_pct: latestAnomaly.metric_type === "events" ? latestAnomaly.percent_change : 0,
          conversions_pct: null,
        },
        top_page_deltas: factors
          .filter((factor) => factor.type === "page")
          .slice(0, 3)
          .map((factor) => ({
            path: factor.label,
            current: factor.metric_value ?? 0,
            baseline: factor.baseline_value ?? 0,
            percent_change: factor.percent_change ?? 0,
          })),
        top_event_deltas: factors
          .filter((factor) => factor.type === "event")
          .slice(0, 3)
          .map((factor) => ({
            event_name: factor.label,
            current: factor.metric_value ?? 0,
            baseline: factor.baseline_value ?? 0,
            percent_change: factor.percent_change ?? 0,
          })),
        uptime_signals:
          analytics.uptime.checks24h > analytics.uptime.checksUp24h
            ? [`${analytics.uptime.checks24h - analytics.uptime.checksUp24h} failed uptime check(s) in the last 24h.`]
            : [],
        threat_signals: threatOverview.top_risk_reasons.slice(0, 2),
        change_signals: latestChange ? [`Recent change: ${latestChange.title}`] : [],
        source_signals: [],
        strongest_factors: factors.length
          ? factors.slice(0, 4).map((factor) => factor.description)
          : insights.key_points.slice(0, 4),
      };
      spikeExplanation = buildFallbackSpikeExplanation(spikeInput, "deferred_ai_for_fast_page_load");
    }
    if (latestChange) {
      const changeMetrics = latestChange.metrics;
      const changeDeltas: ChangeImpactNarrativeInput["metric_deltas"] = {
        sessions_before: changeMetrics.sessions_before,
        sessions_after: changeMetrics.sessions_after,
        sessions_percent_change: changeMetrics.sessions_percent_change,
        pageviews_before: changeMetrics.pageviews_before,
        pageviews_after: changeMetrics.pageviews_after,
        pageviews_percent_change: changeMetrics.pageviews_percent_change,
        events_before: changeMetrics.events_before,
        events_after: changeMetrics.events_after,
        events_percent_change: changeMetrics.events_percent_change,
        conversions_before: changeMetrics.conversions_before,
        conversions_after: changeMetrics.conversions_after,
        conversions_percent_change: changeMetrics.conversions_percent_change,
      };
      changeNarrative = buildFallbackChangeImpactNarrative(
        {
          website_name: site.name,
          change_log: {
            id: latestChange.change_log_id,
            title: latestChange.title,
            description: latestChange.summary,
            change_type: latestChange.change_type,
            created_at: latestChange.created_at,
            source: "stored-change-impact",
            metadata: {},
          },
          impact_window: {
            baseline_start: "Stored baseline window",
            baseline_end: latestChange.created_at,
            post_start: latestChange.created_at,
            post_end: "Stored post-change window",
            window_hours: 24,
          },
          metric_deltas: changeDeltas,
          top_page_deltas: latestChange.notable_differences.filter((item) => item.startsWith("Page ")),
          top_event_deltas: latestChange.notable_differences.filter((item) => item.startsWith("Event ")),
          uptime_signals:
            changeMetrics.uptime_failures_after > changeMetrics.uptime_failures_before
              ? ["Uptime failures increased after this change."]
              : [],
          threat_signals:
            changeMetrics.risk_sessions_after != null &&
            changeMetrics.risk_sessions_before != null &&
            changeMetrics.risk_sessions_after > changeMetrics.risk_sessions_before
              ? ["Risky sessions increased after this change."]
              : [],
          anomaly_signals: insights.anomalies.slice(0, 2).map((anomaly) => `${anomaly.anomaly_type} on ${anomaly.date}`),
          strongest_factors: latestChange.notable_differences.slice(0, 5),
          impact_flags: [...latestChange.flags, changeDirectionFlag(changeDeltas)],
        },
        "deferred_ai_for_fast_page_load",
      );
    }
    const recommendationBase: Omit<WebsiteRecommendationsInput, "recommended_priority_context"> = {
      website_name: site.name,
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
        has_conversion_data: latestChange?.metrics.conversions_before != null,
        conversion_change_pct: latestChange?.metrics.conversions_percent_change ?? null,
      },
      strongest_issues: [
        ...insights.key_points.slice(0, 2),
        ...threatOverview.top_risk_reasons.slice(0, 2).map((r) => `Threat reason: ${r}`),
      ].slice(0, 5),
      strongest_opportunities: analytics.topPages
        .slice(0, 3)
        .map((p) => `Top page opportunity: ${p.path}`),
    };
    const recommendationCandidates = prioritizeWebsiteRecommendations(recommendationBase);
    recommendations = buildFallbackWebsiteRecommendations({
      ...recommendationBase,
      recommended_priority_context: {
        highest_priority: highestRecommendationPriority(recommendationCandidates),
        candidates: recommendationCandidates,
      },
    });
    alertCenter = await getWebsiteAlertCenterData(site.id, {
      websiteName: site.name,
      analytics,
      insights,
      threatOverview,
      threatLeaderboard,
      changeImpacts,
    });
    [notifications, caseWorkbench] = await Promise.all([
      getWebsiteNotifications(site.id),
      getCaseWorkbenchData(site.id, "all"),
    ]);
  }

  const origin = await getRequestOrigin();
  const scriptSrc = `${origin}/tracker/wip.js`;
  const snippet = `<script async src="${scriptSrc}" data-site-key="${site.tracking_public_key}"></script>`;

  const apifyWorkerConfigured = Boolean(
    (process.env.APIFY_API_TOKEN?.trim() || process.env.APIFY_TOKEN?.trim()) && process.env.APIFY_ACTOR_ID?.trim(),
  );
  const crawlUnavailableReason = seoEnabled && !apifyWorkerConfigured
    ? "SEO crawl worker not connected yet. Stored reports can refresh, but new crawls need the worker enabled."
    : null;
  const crawlIssueTotal =
    (crawlSnapshot?.notice_count ?? 0) +
    (crawlSnapshot?.warning_count ?? 0) +
    (crawlSnapshot?.critical_count ?? 0);
  const attentionItems = Array.from(
    new Set(
      topCrawlIssues.map((issue) => {
        const subject = issue.url || issue.title || site.primary_domain;
        const priority = issue.priorityLabel || issue.issue_severity || "Review";
        const label = issue.title && issue.title !== issue.url ? issue.title : issue.issue_type;
        return `${priority}: ${label} on ${subject}`;
      }),
    ),
  ).slice(0, 4);

  const overviewBriefing = buildOverviewBriefing({
    siteState,
    intelligence: siteIntelligence,
    seoEnabled,
    canUseReputationPulse,
    showReputationPulseTeaser,
  });
  const briefingCards: CommandCenterBriefingCard[] = [
    {
      id: "monitoring-status",
      eyebrow: "Monitoring status",
      title: overviewBriefing.monitoringStatus.title,
      description: overviewBriefing.monitoringStatus.description,
      statusLabel: overviewBriefing.monitoringStatus.status,
      statusTone: toneForMonitoring(overviewBriefing.monitoringStatus.status),
      meta: [
        `Uptime: ${briefingTimestamp(overviewBriefing.monitoringStatus.lastUptimeCheck)}`,
        `SEO crawl: ${briefingTimestamp(overviewBriefing.monitoringStatus.lastSeoCrawl, "Not crawled yet")}`,
        uptimeSnapshot?.frequencyMinutes
          ? `Checks every ${uptimeSnapshot.frequencyMinutes} min`
          : "Frequency warming up",
      ],
      cta: overviewBriefing.monitoringStatus.cta,
      targetTab: tabFromHref(overviewBriefing.monitoringStatus.href, "performance"),
      accent: "cyan",
    },
    {
      id: "priority-issue",
      eyebrow: "Priority issue",
      title: overviewBriefing.priorityIssue.title,
      description: overviewBriefing.priorityIssue.description,
      statusLabel: overviewBriefing.priorityIssue.severity === "none" ? "clear" : overviewBriefing.priorityIssue.severity,
      statusTone: toneForSeverity(overviewBriefing.priorityIssue.severity),
      meta: siteState.seo.summary
        ? [`${crawlIssueTotal.toLocaleString("en-US")} crawl issues`, `${crawlSnapshot?.pages_crawled.toLocaleString("en-US") ?? "0"} pages checked`]
        : ["No completed crawl yet", "Run a scan for real priorities"],
      cta: overviewBriefing.priorityIssue.cta,
      targetTab: tabFromHref(overviewBriefing.priorityIssue.href, seoEnabled ? "seo-crawl" : "performance"),
      accent: "amber",
    },
    {
      id: "site-momentum",
      eyebrow: "Site momentum",
      title: overviewBriefing.siteMomentum.title,
      description: overviewBriefing.siteMomentum.description,
      statusLabel: overviewBriefing.siteMomentum.trend,
      statusTone: toneForMomentum(overviewBriefing.siteMomentum.trend),
      meta: [
        crawlRunHistory.length > 1 ? `${crawlRunHistory.length} crawl snapshots` : "Needs another scan",
        uptimeHistory.length > 1 ? `${uptimeHistory.length} uptime checks loaded` : "Uptime history still young",
      ],
      cta: overviewBriefing.siteMomentum.cta,
      targetTab: tabFromHref(overviewBriefing.siteMomentum.href, seoEnabled ? "seo-crawl" : "performance"),
      accent: "violet",
    },
    {
      id: "next-best-action",
      eyebrow: "Next best action",
      title: overviewBriefing.nextBestAction.title,
      description: overviewBriefing.nextBestAction.description,
      statusLabel: overviewBriefing.nextBestAction.status === "none" ? "ready" : overviewBriefing.nextBestAction.status,
      statusTone: toneForSeverity(overviewBriefing.nextBestAction.status),
      meta: [
        `${analytics.overview.sessions24h.toLocaleString("en-US")} sessions in 24h`,
        canUseReputationPulse
          ? `${socialWatchTerms.filter((term) => term.is_active).length} reputation terms watched`
          : showReputationPulseTeaser
            ? "Reputation Pulse teaser available"
            : "Reputation Pulse locked",
      ],
      cta: overviewBriefing.nextBestAction.cta,
      targetTab: tabFromHref(overviewBriefing.nextBestAction.href, "traffic"),
      accent: "pink",
    },
  ];
  const issueBreakdown = [
    { name: "Critical", value: crawlSnapshot?.critical_count ?? 0 },
    { name: "Warnings", value: crawlSnapshot?.warning_count ?? 0 },
    { name: "Notices", value: crawlSnapshot?.notice_count ?? 0 },
  ];
  const detailTabs: CommandCenterTab[] = [
    { id: "traffic", label: "Traffic" },
    { id: "performance", label: "Performance" },
    ...(seoEnabled ? [{ id: "seo-crawl", label: "SEO Crawl" }] : []),
    ...(canUseReputationPulse || showReputationPulseTeaser ? [{ id: "reputation", label: "Reputation Pulse" }] : []),
    ...(canUseIntelligence
      ? [
          { id: "site-signals", label: "Site Signals" },
          { id: "changes", label: "Changes" },
          { id: "action-queue", label: "Action Queue" },
          { id: "alerts", label: "Alerts" },
        ]
      : []),
    { id: "tracker-setup", label: "Tracker Setup" },
  ];
  const headerInfoBtn = "h-4 w-4 min-h-4 min-w-4 border-white/25 bg-white/10 text-white/80";

 return (
    <main className="relative isolate mx-auto max-w-6xl space-y-10 overflow-hidden rounded-b-3xl px-6 py-12 sm:px-7">
      <div className="ui-dashboard-ambient" aria-hidden />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-80 bg-[radial-gradient(circle_at_top,rgba(246,121,208,0.18),transparent_58%)]"
        aria-hidden
      />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <Link
            href="/dashboard"
            className="text-xs font-bold uppercase tracking-[0.14em] text-brand/90 transition hover:text-brand hover:underline"
          >
            ← All sites
          </Link>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{site.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/70">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
              Site selector: <span className="font-semibold text-white">{site.primary_domain}</span>
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
              Dashboard loaded: <span className="font-semibold text-white">{dashboardLoadedLabel}</span>
            </span>
            {seoEnabled ? (
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                <span className="inline-flex items-center gap-1">
                  Last SEO
                  <InfoTooltip buttonClassName={headerInfoBtn} {...getMetricExplanation("seo_crawl_section")} />
                  : <span className="font-semibold text-white">{lastSeoLabel}</span>
                </span>
              </span>
            ) : null}
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
              <span className="inline-flex items-center gap-1">
                Last uptime
                <InfoTooltip buttonClassName={headerInfoBtn} {...getMetricExplanation("uptime")} />
                : <span className="font-semibold text-white">{lastUptimeLabel}</span>
              </span>
            </span>
          </div>
        </div>
        <SeoReportRefreshButton
          siteId={site.id}
          seoEnabled={seoEnabled}
          crawlUnavailableReason={crawlUnavailableReason}
          lastSeoLabel={lastSeoLabel}
          variant="hero"
        />
      </div>

      <SiteCommandCenterDashboard
        briefingCards={briefingCards}
        trends={siteTrendsInitial}
        topPages={analytics.topPages}
        issueBreakdown={issueBreakdown}
        attentionItems={attentionItems}
        activityItems={liveActivity}
        tabs={detailTabs}
      >
        <DashboardSection
          kicker="Reality check"
          title="Traffic and engagement"
          subtitle="Verified from stored pageviews and sessions. No placeholder metrics."
          eyebrowRight={<RefreshPageDataButton lastLoadedLabel={`Analytics view loaded ${dashboardLoadedLabel}`} />}
        >
          <SiteAnalyticsCharts analytics={analytics} />
        </DashboardSection>

        <div className="space-y-5">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-slate-700">
            Uptime here is stored/manual probe data. Useful, but not a magic live-monitoring cape unless the runner is
            actually scheduled.
          </div>
          <UptimeMonitorCard
            siteId={site.id}
            snapshot={uptimeSnapshot}
            history={uptimeCardHistory}
          />
        </div>

        {seoEnabled ? (
          <div className="space-y-6">
            <SiteSeoHealth domain={site.primary_domain} analytics={analytics} />
            <SeoCrawlIntelligenceSection
              latestRun={crawlSnapshot}
              previousHealthScore={crawlRunHistory.at(-2)?.health_score ?? null}
              topIssues={topCrawlIssues}
              crawlStatus={siteState.seo.status}
              crawlErrorMessage={siteState.seo.errorMessage}
            />
            {canUseIntelligence ? (
              <ResponseCodeDashboardCard
                siteId={site.id}
                onPageBreakdown={onPageForReport}
                topIssues={topCrawlIssues}
                crawlHealthScore={crawlSnapshot?.health_score ?? null}
              />
            ) : null}
            {canUseIntelligence ? (
              <AiSeoRecommendationsCard siteId={site.id} crawlRunId={crawlSnapshot?.id ?? null} />
            ) : null}
          </div>
        ) : null}

        {canUseReputationPulse ? (
          <ReputationPulsePanel
            siteId={site.id}
            watchTerms={socialWatchTerms}
            watchTermLimit={getPlanLimit(billing.accountKind, "reputationWatchTerms") ?? 0}
            mentions={socialAttentionMentions}
            latestCheckAt={siteState.reputation.completedAt}
            reputationSummary={siteState.reputation.summary}
          />
        ) : showReputationPulseTeaser ? (
          <ReputationPulseTeaser />
        ) : null}

        {canUseIntelligence ? (
          <div className="space-y-6">
            <SiteSignalSummaryCard
              analytics={analytics}
              insights={insights}
              siteState={siteState}
              threatOverview={threatOverview}
              watchTermCount={socialWatchTerms.filter((term) => term.is_active).length}
            />
            <SiteInsightsCard insights={insights} />
            <ThreatOverviewCard
              overview={threatOverview}
              leaderboard={threatLeaderboard}
              watchTermCount={socialWatchTerms.filter((term) => term.is_active).length}
              reputationFlaggedCount={siteState.reputation.summary?.flagged_mentions ?? 0}
              reputationLatestCheckAt={siteState.reputation.completedAt}
            />
            <FlaggedActivityCard items={flaggedActivity} />
          </div>
        ) : null}

        {canUseIntelligence ? (
          <div className="space-y-6">
            <ChangeImpactCard siteId={site.id} impacts={changeImpacts} />
            <LazyChangeImpactNarrativeCard
              changeLogId={changeImpacts[0]?.change_log_id ?? null}
              fallback={changeNarrative}
            />
          </div>
        ) : null}

        {canUseIntelligence ? (
          <div className="space-y-6">
            {recommendations ? <RecommendationsCard recommendations={recommendations} /> : null}
            <NotificationCenterCard websiteId={site.id} notifications={notifications} />
            <CaseWorkbenchCard
              websiteId={site.id}
              cases={caseWorkbench.cases}
              notesByCaseId={caseWorkbench.notes_by_case_id}
              notifications={notifications}
            />
            <PlaybookCard playbooks={alertCenter.playbooks} />
            <AnalystChatCard websiteId={site.id} />
          </div>
        ) : null}

        {canUseIntelligence ? (
          <div className="space-y-6">
            <LazyAiSummaryCard websiteId={site.id} />
            <LazySpikeExplanationCard websiteId={site.id} fallback={spikeExplanation} />
            <AlertCenterCard alerts={alertCenter.alerts} />
          </div>
        ) : null}

        <DashboardSection
          kicker="Install"
          title="Paste this. Commit. Sleep slightly better."
          subtitle={
            <>
              Put it before <span className="font-semibold text-slate-900">{"</body>"}</span> on every page you want
              measured. Requests go to{" "}
              <span className="font-mono text-xs font-semibold text-slate-900">{origin}</span>.
            </>
          }
          meta="If this isn’t on a page, that page doesn’t exist to analytics. Harsh, but fair."
        >
          <pre className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-slate-950 p-4 text-xs leading-relaxed text-white/85">
            <code>{snippet}</code>
          </pre>
          <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Public key</p>
            <p className="mt-2 text-xs text-slate-700">
              Also duplicated as <span className="font-semibold text-slate-900">data-site-key</span> — this is how we
              know which site the events belong to.
            </p>
            <p className="mt-2 break-all font-mono text-xs font-semibold text-slate-950">{site.tracking_public_key}</p>
          </div>
        </DashboardSection>
      </SiteCommandCenterDashboard>

      <DashboardSection
        emphasis="red"
        kicker="Danger zone"
        title="Remove this site (no fake drama, just consequences)"
        subtitle="This removes the property from your dashboard. Existing rows stay in the database for now, but the tracker stops accepting new events for this key."
      >
        <DeleteSiteButton siteId={site.id} siteName={site.name} />
      </DashboardSection>
    </main>
  );
}
