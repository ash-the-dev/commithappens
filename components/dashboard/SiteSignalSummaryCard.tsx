import { DashboardSection } from "@/components/dashboard/DashboardSection";
import type { SiteAnalytics } from "@/lib/db/analytics";
import type { WebsiteInsights } from "@/lib/db/insights";
import type { WebsiteThreatOverview } from "@/lib/db/threats";
import type { SiteIntelligenceState } from "@/services/siteStateService";

type Props = {
  analytics: SiteAnalytics;
  insights: WebsiteInsights;
  siteState: SiteIntelligenceState;
  threatOverview: WebsiteThreatOverview;
  watchTermCount: number;
};

function trafficDirection(summary: SiteIntelligenceState["analytics"]["summary"]): string {
  if (!summary) return "traffic is still warming up";
  if (summary.trend === "up") return "traffic is up";
  if (summary.trend === "down") return "traffic is down";
  return "traffic is stable";
}

function biggestCheck(input: Props): string {
  if (input.siteState.uptime.summary?.status === "offline") return "uptime dipped, so check reachability first";
  if (input.analytics.overview.events24h === 0) return "no conversion events are being tracked";
  if (input.insights.latest_anomaly?.anomaly_type === "drop") return "traffic dropped compared to the previous period";
  if (input.siteState.reputation.summary && input.watchTermCount <= 1) return "reputation is quiet, but watch terms are limited";
  return "top pages and conversion signals should get the next human look";
}

export function SiteSignalSummaryCard(props: Props) {
  const reputation = props.siteState.reputation.summary;
  const uptime = props.siteState.uptime.summary;
  const traffic = trafficDirection(props.siteState.analytics.summary);
  const reputationCopy = reputation?.flagged_mentions
    ? `${reputation.flagged_mentions} reputation flag${reputation.flagged_mentions === 1 ? "" : "s"} need review`
    : "no reputation threats are shouting from the bushes";
  const suspicious = props.threatOverview.total_flagged_sessions > 0
    ? `${props.threatOverview.total_flagged_sessions} suspicious traffic signal${props.threatOverview.total_flagged_sessions === 1 ? "" : "s"}`
    : "no suspicious traffic signal is currently yelling";

  return (
    <DashboardSection
      kicker="Signal Summary"
      title="Situation report"
      subtitle="The executive summary of weirdness, momentum, and risk. Based on stored traffic, uptime, reputation, and speed checks."
    >
      <div className="rounded-2xl border border-slate-200/80 bg-white/75 p-4">
        <p className="text-sm font-semibold text-slate-950">
          <span aria-hidden="true">🛰️</span> The takeaway
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-800">
          {traffic}, uptime is {uptime?.status ?? "not confirmed yet"}, and {reputationCopy}. Also, {suspicious}.
          The main thing to inspect is whether movement came from normal demand, tracking gaps, or a recent site change.
        </p>
        <p className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-950">
          <span aria-hidden="true">⚡</span> Biggest thing to check: {biggestCheck(props)}.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
            {props.insights.latest_anomaly?.anomaly_type === "drop" ? "📉 Demand drop" : props.insights.latest_anomaly?.anomaly_type === "spike" ? "⚡ Spike detected" : "🛡️ Stable signal"}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
            {props.analytics.overview.events24h === 0 ? "👻 No conversion events" : "🎯 Events tracked"}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
            {props.threatOverview.total_flagged_sessions > 0 ? "🚨 Threat activity" : "🛡️ No threat activity"}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
            📡 Watched terms: {props.watchTermCount}
          </span>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Evidence: based on stored traffic, uptime, reputation, and speed checks. No live-check cosplay.
        </p>
      </div>
    </DashboardSection>
  );
}
