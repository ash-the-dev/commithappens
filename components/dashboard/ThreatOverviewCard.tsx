import type { WebsiteThreatLeaderboard, WebsiteThreatOverview } from "@/lib/db/threats";
import { DashboardSection } from "@/components/dashboard/DashboardSection";

type Props = {
  overview: WebsiteThreatOverview;
  leaderboard: WebsiteThreatLeaderboard;
};

function prettyReason(code: string): string {
  return code.replace(/_/g, " ");
}

export function ThreatOverviewCard({ overview, leaderboard }: Props) {
  const hasFlags = overview.total_flagged_sessions > 0;

  return (
    <DashboardSection
      kicker="Threat radar"
      title="Anything shady?"
      subtitle="This is about risk signals in your traffic — not a vibe check. Fewer false alarms, more ‘oh, that’s actually weird.’"
    >
      {!hasFlags ? (
        <p className="text-sm text-slate-700">All quiet. Either you’re boring (good), or nobody’s tried anything yet.</p>
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
                {overview.total_flagged_sessions}
              </p>
            </div>
            <div className="rounded-2xl border border-rose-300/60 bg-rose-500/10 p-3">
              <p className="text-xs uppercase tracking-wide text-rose-950/80">High risk</p>
              <p className="mt-1 text-xl font-semibold text-rose-950">
                {overview.high_risk_sessions}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/60 bg-amber-500/10 p-3">
              <p className="text-xs uppercase tracking-wide text-amber-950/80">Medium risk</p>
              <p className="mt-1 text-xl font-semibold text-amber-950">
                {overview.medium_risk_sessions}
              </p>
            </div>
            <div className="rounded-2xl border border-fuchsia-300/55 bg-fuchsia-500/10 p-3">
              <p className="text-xs uppercase tracking-wide text-fuchsia-950/80">Low risk</p>
              <p className="mt-1 text-xl font-semibold text-fuchsia-950">
                {overview.low_risk_sessions}
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
