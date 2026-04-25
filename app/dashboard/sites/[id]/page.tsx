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
import { getBillingAccess } from "@/lib/billing/access";
import { UptimeMonitorCard } from "@/components/dashboard/UptimeMonitorCard";
import { ensureUptimeCheckForWebsite, getWebsiteUptimeHistory, getWebsiteUptimeSnapshot } from "@/lib/db/uptime";
import { getPlanMonitoringFrequency } from "@/lib/billing/plan-monitoring";
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
import {
  SiteCommandCenterDashboard,
  type CommandCenterSummaryCard,
  type CommandCenterTab,
} from "@/components/dashboard/SiteCommandCenterDashboard";

type Props = { params: Promise<{ id: string }> };

function compactDate(iso: string | null | undefined): string {
  if (!iso) return "Not run yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not run yet";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  const seoEnabled = billing.seoEnabled;
  const canUseIntelligence = billing.canUseIntelligence;

  await ensureUptimeCheckForWebsite({
    websiteId: site.id,
    userId: session.user.id,
    frequencyMinutes: getPlanMonitoringFrequency(billing.accountKind),
  }).catch((err) => {
    console.error("[site-detail] failed to ensure uptime check", { siteId: site.id, err });
  });

  const [
    analytics,
    liveActivity,
    uptimeSnapshot,
    uptimeHistory,
    crawlSnapshot,
    topCrawlIssues,
    crawlRunHistory,
    onPageForReport,
  ] = await Promise.all([
    getSiteAnalytics(site.id),
    getSiteLiveActivity(site.id, 25),
    getWebsiteUptimeSnapshot(site.id),
    getWebsiteUptimeHistory(site.id, 50).catch(() => []),
    getLatestSeoCrawlRun(site.id).catch(() => null),
    getTopCrawlIssues(site.id, 3).catch(() => []),
    getSeoCrawlRunHistory(site.id, 18).catch(() => []),
    getSeoCrawlOnPageBreakdown(site.id).catch(() => null),
  ]);
  const uptimeCardHistory = uptimeHistory.slice(0, 50);
  const siteTrendsInitial = buildSiteTrendsPayload(crawlRunHistory, uptimeHistory);

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

  const apifyWorkerConfigured = Boolean(process.env.APIFY_API_TOKEN?.trim() && process.env.APIFY_ACTOR_ID?.trim());
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

  const summaryCards: CommandCenterSummaryCard[] = [
    {
      id: "seo-health",
      title: "SEO health",
      value: crawlSnapshot ? `${Math.round(crawlSnapshot.health_score)}` : "No crawl",
      caption: crawlSnapshot
        ? `${crawlSnapshot.pages_crawled.toLocaleString("en-US")} pages in latest stored crawl`
        : "Run a crawl and let’s get something to judge.",
      badge: crawlSnapshot ? compactDate(crawlSnapshot.created_at) : "Waiting",
      targetTab: "seo-crawl",
      accent: "cyan",
    },
    {
      id: "traffic",
      title: "Traffic",
      value: analytics.overview.sessions24h.toLocaleString("en-US"),
      caption: `${analytics.overview.pageviews24h.toLocaleString("en-US")} pageviews in the last 24h`,
      badge: "24h",
      targetTab: "traffic",
      accent: "blue",
    },
    {
      id: "performance",
      title: "Performance",
      value:
        analytics.vitalAverages.length > 0
          ? `${analytics.vitalAverages.length} vitals`
          : analytics.uptime.avgResponse24h > 0
            ? `${Math.round(analytics.uptime.avgResponse24h)}ms`
            : "No samples",
      caption: "Real-user vitals plus probe history. Directional, not gospel.",
      badge: "Directional",
      targetTab: "performance",
      accent: "violet",
    },
    {
      id: "issues",
      title: "Issues",
      value: crawlIssueTotal.toLocaleString("en-US"),
      caption:
        crawlIssueTotal > 0
          ? "Crawl warnings, notices, and criticals that need triage."
          : "No crawl issues stored yet. Suspiciously empty.",
      badge: "Alert",
      targetTab: canUseIntelligence ? "issues" : "seo-crawl",
      accent: "amber",
    },
    {
      id: "changes",
      title: "Recent change",
      value: topChange?.change_type ?? "None",
      caption: topChange ? "Latest impact record is ready for judgment." : "No recent deploy notes. Bold strategy.",
      badge: `${changeImpacts.length} records`,
      targetTab: canUseIntelligence ? "comparison" : "traffic",
      accent: "pink",
    },
    {
      id: "crawl-status",
      title: "Crawl status",
      value: crawlSnapshot ? compactDate(crawlSnapshot.created_at) : "Not run",
      caption: apifyWorkerConfigured
        ? "Apify worker is connected. Run SEO Crawl starts a background crawl."
        : "Stored reports can refresh, but new crawls need the worker connected.",
      badge: apifyWorkerConfigured ? "Worker ready" : "Worker off",
      targetTab: "seo-crawl",
      accent: "slate",
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
    { id: "seo-crawl", label: "SEO Crawl" },
    ...(canUseIntelligence
      ? [
          { id: "issues", label: "Issues" },
          { id: "comparison", label: "Comparison" },
          { id: "actions", label: "Actions" },
          { id: "anomalies", label: "Anomalies" },
        ]
      : []),
    { id: "install", label: "Install" },
  ];

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
              Last updated: <span className="font-semibold text-white">{compactDate(crawlSnapshot?.created_at ?? siteTrendsInitial.generatedAt)}</span>
            </span>
          </div>
        </div>
        <SeoReportRefreshButton
          siteId={site.id}
          seoEnabled={seoEnabled}
          crawlUnavailableReason={crawlUnavailableReason}
          variant="hero"
        />
      </div>

      <SiteCommandCenterDashboard
        summaryCards={summaryCards}
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
          subtitle="Verified from pageviews.occurred_at and distinct session_id. No placeholder metrics."
          eyebrowRight={<RefreshPageDataButton idleLabel="Refresh stats" loadingLabel="Refreshing..." />}
        >
          <SiteAnalyticsCharts analytics={analytics} />
        </DashboardSection>

        <div className="space-y-5">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-slate-700">
            Uptime here is stored/manual probe data. Useful, but not a magic live-monitoring cape unless the runner is
            actually scheduled.
          </div>
          <UptimeMonitorCard
            snapshot={uptimeSnapshot}
            history={uptimeCardHistory}
          />
          {billing.accountKind !== "free" ? (
            <SiteSeoHealth domain={site.primary_domain} analytics={analytics} />
          ) : null}
        </div>

        <div className="space-y-6">
          <SeoCrawlIntelligenceSection
            siteId={site.id}
            seoEnabled={seoEnabled}
            crawlUnavailableReason={crawlUnavailableReason}
            latestRun={crawlSnapshot}
            topIssues={topCrawlIssues}
          />
          {canUseIntelligence && seoEnabled ? <AiSeoRecommendationsCard siteId={site.id} /> : null}
        </div>

        {canUseIntelligence ? (
          <div className="space-y-6">
            <SiteInsightsCard insights={insights} />
            <ThreatOverviewCard overview={threatOverview} leaderboard={threatLeaderboard} />
            <FlaggedActivityCard items={flaggedActivity} />
          </div>
        ) : null}

        {canUseIntelligence ? (
          <div className="space-y-6">
            {seoEnabled ? (
              <ResponseCodeDashboardCard siteId={site.id} onPageBreakdown={onPageForReport} />
            ) : (
              <DashboardSection
                kicker="SEO intelligence"
                title="SEO comparison is not enabled yet"
                subtitle="The dashboard will show response-code comparison, crawl deltas, and action playbooks here as soon as SEO crawling is enabled for this account."
              >
                <p className="text-sm text-slate-800">
                  Your traffic, probe samples, and latest crawl snapshot still stay visible above. This panel is reserved
                  for the deeper response-code report.
                </p>
              </DashboardSection>
            )}
            <ChangeImpactCard impacts={changeImpacts} />
            <ChangeImpactNarrativeCard narrative={changeNarrative} />
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
            {aiSummary ? <AiSummaryCard summaryResult={aiSummary} /> : null}
            <SpikeExplanationCard explanation={spikeExplanation} />
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
