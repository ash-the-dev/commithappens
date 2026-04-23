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
import { getWebsiteInsights } from "@/lib/db/insights";
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
import { getWebsiteAlertCenterData } from "@/lib/db/alerts";
import {
  getWebsiteNotifications,
  syncWebsiteNotifications,
} from "@/lib/db/notifications";
import { getCaseWorkbenchData } from "@/lib/db/cases";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { ResponseCodeDashboardCard } from "@/components/dashboard/ResponseCodeDashboardCard";
import { RefreshPageDataButton } from "@/components/dashboard/RefreshPageDataButton";

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
  const [analytics, liveActivity, threatOverview, changeImpacts] = await Promise.all([
    getSiteAnalytics(site.id),
    getSiteLiveActivity(site.id, 25),
    getWebsiteThreatOverview(site.id),
    getWebsiteChangeImpacts(site.id),
  ]);
  const [insights, flaggedActivity, threatLeaderboard] = await Promise.all([
    getWebsiteInsights(site.id, threatOverview),
    getWebsiteFlaggedActivity(site.id, 10, threatOverview),
    getWebsiteThreatLeaderboard(site.id, threatOverview),
  ]);
  const aiSummary = await generateWebsiteAiSummary(
    buildWebsiteSummaryInput({
      websiteName: site.name,
      analytics,
      insights,
      threatOverview,
      changeImpacts,
    }),
  );
  const latestAnomaly = insights.anomalies[0] ?? null;
  const spikeExplanation = latestAnomaly
    ? await generateSpikeExplanation(site.id, latestAnomaly.date, latestAnomaly)
    : null;
  const latestChange = changeImpacts[0] ?? null;
  const changeNarrative = latestChange
    ? await generateChangeImpactNarrative(latestChange.change_log_id)
    : null;
  const recommendations = await generateWebsiteRecommendations(site.id);
  const alertCenter = await getWebsiteAlertCenterData(site.id, {
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
  const [notifications, caseWorkbench] = await Promise.all([
    getWebsiteNotifications(site.id),
    getCaseWorkbenchData(site.id, "all"),
  ]);

  const origin = await getRequestOrigin();
  const scriptSrc = `${origin}/tracker/wip.js`;
  const snippet = `<script async src="${scriptSrc}" data-site-key="${site.tracking_public_key}"></script>`;

  return (
    <main className="relative mx-auto max-w-6xl space-y-10 px-6 py-12">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 rounded-[2.2rem] bg-[radial-gradient(circle_at_top,rgba(246,121,208,0.18),transparent_58%)]"
        aria-hidden
      />
      <div>
        <Link
          href="/dashboard"
          className="text-xs font-semibold uppercase tracking-wide text-brand hover:underline"
        >
          ← All sites
        </Link>
        <h1 className="mt-4 text-3xl font-semibold text-white">{site.name}</h1>
        <p className="mt-2 text-sm text-brand-muted">{site.primary_domain}</p>
      </div>

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
          <p className="mt-2 break-all font-mono text-xs font-semibold text-slate-950">
            {site.tracking_public_key}
          </p>
        </div>
      </DashboardSection>

      <DashboardSection
        kicker="Reality check"
        title="Here’s what actually happened."
        subtitle="You pushed. The internet reacted. This is the fallout: traffic, speed signals, and whether your site stayed online like a grown-up."
        eyebrowRight={<RefreshPageDataButton idleLabel="Refresh stats" loadingLabel="Refreshing..." />}
      >
        <SiteAnalyticsCharts analytics={analytics} />
      </DashboardSection>

      <SiteSeoHealth domain={site.primary_domain} analytics={analytics} />

      <ResponseCodeDashboardCard siteId={site.id} />

      <SiteInsightsCard insights={insights} />

      <AiSummaryCard summaryResult={aiSummary} />

      <SpikeExplanationCard explanation={spikeExplanation} />

      <ChangeImpactNarrativeCard narrative={changeNarrative} />

      <RecommendationsCard recommendations={recommendations} />

      <NotificationCenterCard websiteId={site.id} notifications={notifications} />

      <CaseWorkbenchCard
        websiteId={site.id}
        cases={caseWorkbench.cases}
        notesByCaseId={caseWorkbench.notes_by_case_id}
        notifications={notifications}
      />

      <AnalystChatCard websiteId={site.id} />

      <AlertCenterCard alerts={alertCenter.alerts} />

      <PlaybookCard playbooks={alertCenter.playbooks} />

      <ThreatOverviewCard overview={threatOverview} leaderboard={threatLeaderboard} />

      <FlaggedActivityCard items={flaggedActivity} />

      <ChangeImpactCard impacts={changeImpacts} />

      <LiveActivityCard items={liveActivity} />

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
