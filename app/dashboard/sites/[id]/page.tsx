import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getRequestOrigin } from "@/lib/app-url";
import { authOptions } from "@/lib/auth/options";
import { LiveActivityCard } from "@/components/dashboard/LiveActivityCard";
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
import { AiSummaryCard } from "@/components/dashboard/AiSummaryCard";
import { SpikeExplanationCard } from "@/components/dashboard/SpikeExplanationCard";
import { ChangeImpactNarrativeCard } from "@/components/dashboard/ChangeImpactNarrativeCard";
import { RecommendationsCard } from "@/components/dashboard/RecommendationsCard";
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
import { buildWebsiteSummaryInput } from "@/lib/ai/build-website-summary-input";
import { generateWebsiteAiSummary } from "@/lib/ai/generate-website-ai-summary";
import { generateSpikeExplanation } from "@/lib/ai/generate-spike-explanation";
import { generateChangeImpactNarrative } from "@/lib/ai/generate-change-impact-narrative";
import { generateWebsiteRecommendations } from "@/lib/ai/generate-website-recommendations";
import type { WebsiteAlertCenterData } from "@/lib/db/alerts";
import { getWebsiteAlertCenterData } from "@/lib/db/alerts";
import {
  getWebsiteNotifications,
  syncWebsiteNotifications,
} from "@/lib/db/notifications";
import { getCaseWorkbenchData } from "@/lib/db/cases";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { ResponseCodeDashboardCard } from "@/components/dashboard/ResponseCodeDashboardCard";
import { RefreshPageDataButton } from "@/components/dashboard/RefreshPageDataButton";
import { DashboardJumpNav } from "@/components/dashboard/DashboardJumpNav";
import { DashboardOverviewCards } from "@/components/dashboard/DashboardOverviewCards";
import type { OverviewCard } from "@/components/dashboard/DashboardOverviewCards";
import { getBillingAccess } from "@/lib/billing/access";
import { IntelligencePaywallCard } from "@/components/dashboard/IntelligencePaywallCard";
import { UptimeMonitorCard } from "@/components/dashboard/UptimeMonitorCard";
import { getWebsiteUptimeHistory, getWebsiteUptimeSnapshot } from "@/lib/db/uptime";
import { SeoCrawlIntelligenceSection } from "@/components/dashboard/SeoCrawlIntelligenceSection";
import { PremiumTeaserCard } from "@/components/dashboard/PremiumTeaserCard";
import { getLatestSeoCrawlRun, getTopCrawlIssues } from "@/lib/db/seo-crawl-intelligence";

type Props = { params: Promise<{ id: string }> };

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
  const seoEnabled = billing.seoEnabled;
  const canUseIntelligence = billing.canUseIntelligence;

  const [analytics, liveActivity, uptimeSnapshot, uptimeHistory, crawlSnapshot, topCrawlIssues] = await Promise.all([
    getSiteAnalytics(site.id),
    getSiteLiveActivity(site.id, 25),
    getWebsiteUptimeSnapshot(site.id),
    getWebsiteUptimeHistory(site.id, billing.accountKind === "free" ? 6 : 20),
    getLatestSeoCrawlRun(site.id).catch(() => null),
    getTopCrawlIssues(site.id, 3).catch(() => []),
  ]);

  let threatOverview = emptyWebsiteThreatOverview();
  let changeImpacts: Awaited<ReturnType<typeof getWebsiteChangeImpacts>> = [];
  let insights = emptyWebsiteInsightsForFreePlan();
  let flaggedActivity: Awaited<ReturnType<typeof getWebsiteFlaggedActivity>> = [];
  let threatLeaderboard = emptyWebsiteThreatLeaderboard();
  let aiSummary: Awaited<ReturnType<typeof generateWebsiteAiSummary>> | null = null;
  let latestAnomaly: (typeof insights.anomalies)[0] | null = null;
  let spikeExplanation: Awaited<ReturnType<typeof generateSpikeExplanation>> | null = null;
  let changeNarrative: Awaited<ReturnType<typeof generateChangeImpactNarrative>> | null = null;
  let recommendations: Awaited<ReturnType<typeof generateWebsiteRecommendations>> | null = null;
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
    aiSummary = await generateWebsiteAiSummary(
      buildWebsiteSummaryInput({
        websiteName: site.name,
        analytics,
        insights,
        threatOverview,
        changeImpacts,
      }),
    );
    latestAnomaly = insights.anomalies[0] ?? null;
    spikeExplanation = latestAnomaly
      ? await generateSpikeExplanation(site.id, latestAnomaly.date, latestAnomaly)
      : null;
    const latestChange = changeImpacts[0] ?? null;
    changeNarrative = latestChange
      ? await generateChangeImpactNarrative(latestChange.change_log_id)
      : null;
    recommendations = await generateWebsiteRecommendations(site.id);
    alertCenter = await getWebsiteAlertCenterData(site.id, {
      analytics,
      insights,
      threatOverview,
      threatLeaderboard,
      changeImpacts,
    });
    await syncWebsiteNotifications(site.id, {
      alertCenter,
      recommendations,
    });
    [notifications, caseWorkbench] = await Promise.all([
      getWebsiteNotifications(site.id),
      getCaseWorkbenchData(site.id, "all"),
    ]);
  }

  const origin = await getRequestOrigin();
  const scriptSrc = `${origin}/tracker/wip.js`;
  const snippet = `<script async src="${scriptSrc}" data-site-key="${site.tracking_public_key}"></script>`;
  const topChange = changeImpacts[0] ?? null;

  const overviewCardsAll: OverviewCard[] = [
    {
      id: "traffic",
      title: "Traffic",
      helpMetricId: "traffic_overview",
      metricPrimary: `${analytics.overview.sessions24h.toLocaleString("en-US")} visits (24h)`,
      metricSecondary: `${analytics.overview.pageviews24h.toLocaleString("en-US")} pageviews (24h)`,
      status:
        analytics.overview.sessions24h > 0
          ? "Signal is flowing."
          : "No data yet. Verify tracker placement.",
      trend: "stable" as const,
    },
    {
      id: "performance",
      title: "Performance",
      helpMetricId: "performance_overview",
      metricPrimary: analytics.uptime.hasChecks24h
        ? `${analytics.uptime.uptimePct24h.toFixed(2)}% uptime`
        : "No uptime checks",
      metricSecondary:
        analytics.uptime.avgResponse24h > 0
          ? `${Math.round(analytics.uptime.avgResponse24h)}ms avg response`
          : "No response data yet",
      status: analytics.uptime.hasChecks24h ? "Live probe data verified." : "Monitoring not configured yet.",
      trend:
        analytics.uptime.hasChecks24h && analytics.uptime.uptimePct24h >= 99 ? "up" : "down",
    },
    {
      id: "issues",
      title: "Issues",
      helpMetricId: "issues_overview",
      metricPrimary: `${insights.detected_flags.length} active flags`,
      metricSecondary: insights.summary_text,
      status:
        insights.detected_flags.length > 0 ? "Needs attention." : "No major issue signals.",
      trend: insights.detected_flags.length > 0 ? "down" : "stable",
    },
    {
      id: "health",
      title: "Health",
      helpMetricId: "health_overview",
      metricPrimary: `${analytics.vitalAverages.length} CWV metrics`,
      metricSecondary: analytics.vitalAverages.length > 0 ? "Performance samples available" : "No vitals yet",
      status: analytics.vitalAverages.length > 0 ? "Quality telemetry active." : "Waiting on browser telemetry.",
      trend: analytics.vitalAverages.length > 0 ? "up" : "stable",
    },
    {
      id: "changes",
      title: "Changes",
      helpMetricId: "changes_overview",
      metricPrimary: `${changeImpacts.length} impact records`,
      metricSecondary: topChange?.change_type ?? "No recent changes detected",
      status: topChange ? "Latest deployment impact available." : "No new change impacts yet.",
      trend: changeImpacts.length > 0 ? "up" : "stable",
    },
    {
      id: "anomalies",
      title: "Anomalies",
      helpMetricId: "anomalies_overview",
      metricPrimary: `${insights.anomalies.length} anomaly signal(s)`,
      metricSecondary: latestAnomaly
        ? `${latestAnomaly.metric_type} ${latestAnomaly.percent_change > 0 ? "+" : ""}${latestAnomaly.percent_change.toFixed(1)}%`
        : "No anomaly spikes",
      status: latestAnomaly ? "Review anomaly context." : "No anomaly movement.",
      trend: latestAnomaly ? "down" : "stable",
    },
  ];
  const overviewCards: OverviewCard[] = canUseIntelligence
    ? overviewCardsAll
    : overviewCardsAll.filter((c) => c.id === "traffic" || c.id === "performance");
  const jumpSections = canUseIntelligence
    ? [
        { id: "overview", label: "Overview" },
        { id: "traffic", label: "Traffic" },
        { id: "performance", label: "Performance" },
        { id: "issues", label: "Issues" },
        { id: "comparison", label: "Comparison" },
        { id: "actions", label: "Actions" },
        { id: "recent-activity", label: "Recent Activity" },
      ]
    : [
        { id: "overview", label: "Overview" },
        { id: "traffic", label: "Traffic" },
        { id: "performance", label: "Performance" },
        { id: "recent-activity", label: "Recent Activity" },
        { id: "upgrade", label: "More" },
      ];

 return (
    <main className="relative isolate mx-auto max-w-6xl space-y-10 overflow-hidden rounded-b-[1.5rem] px-6 py-12 sm:px-7">
      <div className="ui-dashboard-ambient" aria-hidden />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-80 bg-[radial-gradient(circle_at_top,rgba(246,121,208,0.18),transparent_58%)]"
        aria-hidden
      />
      <div>
        <Link
          href="/dashboard"
          className="text-xs font-bold uppercase tracking-[0.14em] text-brand/90 transition hover:text-brand hover:underline"
        >
          ← All sites
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{site.name}</h1>
        <p className="mt-2 text-sm text-brand-muted">{site.primary_domain}</p>
      </div>

      <DashboardJumpNav sections={jumpSections} />
      <DashboardOverviewCards cards={overviewCards} />

      <details open className="rounded-3xl border border-white/20 bg-white/5 p-2 backdrop-blur-md">
        <summary className="cursor-pointer rounded-2xl px-4 py-3 text-sm font-semibold text-white/90">
          Install snippet
        </summary>
        <div id="install" className="px-2 pb-2">
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
        </div>
      </details>

      <details className="rounded-3xl border border-white/20 bg-white/5 p-2 backdrop-blur-md">
        <summary className="cursor-pointer rounded-2xl px-4 py-3 text-sm font-semibold text-white/90">Traffic</summary>
        <div id="traffic" className="px-2 pb-2">
          <DashboardSection
            kicker="Reality check"
            title="Traffic and engagement"
            subtitle="Verified from pageviews.occurred_at and distinct session_id. No placeholder metrics."
            eyebrowRight={<RefreshPageDataButton idleLabel="Refresh stats" loadingLabel="Refreshing..." />}
          >
            <SiteAnalyticsCharts analytics={analytics} />
          </DashboardSection>
        </div>
      </details>

      <details className="rounded-3xl border border-white/20 bg-white/5 p-2 backdrop-blur-md">
        <summary className="cursor-pointer rounded-2xl px-4 py-3 text-sm font-semibold text-white/90">Performance</summary>
        <div id="performance" className="px-2 pb-2">
          <div className="space-y-5">
            <UptimeMonitorCard
              snapshot={uptimeSnapshot}
              history={uptimeHistory}
              isFreeTier={billing.accountKind === "free"}
            />
            {billing.accountKind === "free" ? (
              <PremiumTeaserCard
                href="/pricing"
                headline="Unlock richer monitoring history"
                subtext="Paid plans include deeper uptime history and advanced monitoring analysis."
                ctaLabel="Upgrade monitoring"
              />
            ) : null}
            {billing.accountKind !== "free" ? (
              <SiteSeoHealth domain={site.primary_domain} analytics={analytics} />
            ) : null}
          </div>
        </div>
      </details>

      <details className="rounded-3xl border border-white/20 bg-white/5 p-2 backdrop-blur-md">
        <summary className="cursor-pointer rounded-2xl px-4 py-3 text-sm font-semibold text-white/90">
          SEO crawl snapshot
        </summary>
        <div className="px-2 pb-2">
          <SeoCrawlIntelligenceSection
            siteId={site.id}
            seoEnabled={seoEnabled}
            latestRun={crawlSnapshot}
            topIssues={topCrawlIssues}
            isFree={billing.accountKind === "free"}
          />
        </div>
      </details>

      {canUseIntelligence ? (
        <>
          <details className="rounded-3xl border border-white/20 bg-white/5 p-2 backdrop-blur-md">
            <summary className="cursor-pointer rounded-2xl px-4 py-3 text-sm font-semibold text-white/90">
              Issues
            </summary>
            <div id="issues" className="space-y-6 px-2 pb-2">
              <SiteInsightsCard insights={insights} />
              <ThreatOverviewCard overview={threatOverview} leaderboard={threatLeaderboard} />
              <FlaggedActivityCard items={flaggedActivity} />
            </div>
          </details>

          <details className="rounded-3xl border border-white/20 bg-white/5 p-2 backdrop-blur-md">
            <summary className="cursor-pointer rounded-2xl px-4 py-3 text-sm font-semibold text-white/90">
              Comparison
            </summary>
            <div id="comparison" className="space-y-6 px-2 pb-2">
              {seoEnabled ? (
                <ResponseCodeDashboardCard siteId={site.id} />
              ) : (
                <DashboardSection
                  kicker="SEO intelligence"
                  title="Committed plan unlock required"
                  subtitle="Situationship includes monitoring and analysis. Upgrade to Committed for SEO crawling, comparison deltas, and action playbooks."
                >
                  <p className="text-sm text-slate-800">
                    Start your 7-day trial of Committed to unlock crawl-based recommendations and side-by-side SEO
                    comparison.
                  </p>
                </DashboardSection>
              )}
              <ChangeImpactCard impacts={changeImpacts} />
              <ChangeImpactNarrativeCard narrative={changeNarrative} />
            </div>
          </details>

          <details className="rounded-3xl border border-white/20 bg-white/5 p-2 backdrop-blur-md">
            <summary className="cursor-pointer rounded-2xl px-4 py-3 text-sm font-semibold text-white/90">Actions</summary>
            <div id="actions" className="space-y-6 px-2 pb-2">
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
          </details>

          <details className="rounded-3xl border border-white/20 bg-white/5 p-2 backdrop-blur-md">
            <summary className="cursor-pointer rounded-2xl px-4 py-3 text-sm font-semibold text-white/90">Anomalies</summary>
            <div id="anomalies" className="space-y-6 px-2 pb-2">
              {aiSummary ? <AiSummaryCard summaryResult={aiSummary} /> : null}
              <SpikeExplanationCard explanation={spikeExplanation} />
              <AlertCenterCard alerts={alertCenter.alerts} />
            </div>
          </details>
        </>
      ) : (
        <details className="rounded-3xl border border-white/20 bg-white/5 p-2 backdrop-blur-md">
          <summary className="cursor-pointer rounded-2xl px-4 py-3 text-sm font-semibold text-white/90">
            Intelligence &amp; growth features
          </summary>
          <div id="upgrade" className="px-2 pb-2">
            <IntelligencePaywallCard />
            <div className="mt-4 opacity-90">
              <p className="text-xs text-white/55">
                On paid plans: SEO response-code comparison, change-impact narratives, AI analyst chat, case workflows,
                and deep threat analysis.
              </p>
            </div>
          </div>
        </details>
      )}

      <details className="rounded-3xl border border-white/20 bg-white/5 p-2 backdrop-blur-md">
        <summary className="cursor-pointer rounded-2xl px-4 py-3 text-sm font-semibold text-white/90">Recent activity</summary>
        <div id="recent-activity" className="px-2 pb-2">
          <LiveActivityCard items={liveActivity} />
        </div>
      </details>

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
