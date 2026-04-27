import type { WebsiteThreatLeaderboard, WebsiteThreatOverview } from "@/lib/db/threats";
import { DashboardSection } from "@/components/dashboard/DashboardSection";

type Props = {
  overview: WebsiteThreatOverview;
  leaderboard: WebsiteThreatLeaderboard;
  watchTermCount?: number;
  reputationFlaggedCount?: number;
  reputationLatestCheckAt?: string | null;
};

function prettyReason(code: string): string {
  return code.replace(/_/g, " ");
}

function timeAgo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.floor(diffMs / 60000));
  if (!Number.isFinite(min)) return null;
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function ThreatOverviewCard({
  overview,
  leaderboard,
  watchTermCount = 0,
  reputationFlaggedCount = 0,
  reputationLatestCheckAt = null,
}: Props) {
  const hasFlags = overview.total_flagged_sessions > 0;
  const latestCheck = timeAgo(reputationLatestCheckAt);

  return (
    <DashboardSection
      kicker="Threat radar"
      title="Anything shady?"
      subtitle="This is about risk signals in your traffic — not a vibe check. Fewer false alarms, more ‘oh, that’s actually weird.’"
    >
      {!hasFlags ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
          <p className="text-sm font-semibold text-slate-950">🛡️ All quiet.</p>
          <p className="mt-2 text-sm text-slate-700">
            Either you’re boring in the best way, or nobody has tried anything yet.
          </p>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-semibold">Why it matters:</span> low weirdness means the traffic quality signal is calm, not absent.
          </p>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-semibold">Do this next:</span> keep watching after major updates and campaign pushes.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Watched terms: {watchTermCount} • Flagged mentions: {reputationFlaggedCount}
            {latestCheck ? ` • Latest reputation check: ${latestCheck}` : ""}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">The takeaway</p>
            <p className="mt-2 text-sm text-slate-900">
              <span className="font-semibold">What happened:</span> we flagged{" "}
              <span className="font-semibold">{overview.total_flagged_sessions}</span> sessions as worth a closer look.
            </p>
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-semibold">Why it matters:</span> some attacks look like traffic until they’re
              suddenly expensive.
            </p>
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-semibold">Do this next:</span> start with high risk, then check the sketchy paths
              list below.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-600">Flagged sessions</p>
              <p className="mt-1 text-xl font-semibold text-slate-950">
                🚨 {overview.total_flagged_sessions}
              </p>
            </div>
            <div className="rounded-2xl border border-rose-300/60 bg-rose-500/10 p-3">
              <p className="text-xs uppercase tracking-wide text-rose-950/80">High risk</p>
              <p className="mt-1 text-xl font-semibold text-rose-950">
                🚨 {overview.high_risk_sessions}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/60 bg-amber-500/10 p-3">
              <p className="text-xs uppercase tracking-wide text-amber-950/80">Medium risk</p>
              <p className="mt-1 text-xl font-semibold text-amber-950">
                ⚠️ {overview.medium_risk_sessions}
              </p>
            </div>
            <div className="rounded-2xl border border-fuchsia-300/55 bg-fuchsia-500/10 p-3">
              <p className="text-xs uppercase tracking-wide text-fuchsia-950/80">Low risk</p>
              <p className="mt-1 text-xl font-semibold text-fuchsia-950">
                📡 {overview.low_risk_sessions}
              </p>
            </div>
          </div>

          {overview.top_risk_reasons.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                Top risk reasons
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {overview.top_risk_reasons.map((reason) => (
                  <span
                    key={reason}
                    className="rounded-full border border-slate-200/90 bg-white/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-800"
                  >
                    {prettyReason(reason)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {leaderboard.risky_paths.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                Risky paths
              </p>
              <p className="mt-1 text-sm text-slate-800">
                {leaderboard.risky_paths
                  .slice(0, 3)
                  .map((item) => `${item.path} (${item.count})`)
                  .join(" · ")}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </DashboardSection>
  );
}
