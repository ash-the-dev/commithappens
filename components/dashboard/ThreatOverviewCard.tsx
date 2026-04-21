import type { WebsiteThreatLeaderboard, WebsiteThreatOverview } from "@/lib/db/threats";

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
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-white/65">
        Anything sketchy?
      </h2>
      {!hasFlags ? (
        <p className="mt-4 text-sm text-white/55">
          Everything looks pretty calm right now.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border/70 bg-black/25 p-3">
              <p className="text-xs uppercase tracking-wide text-white/55">Flagged sessions</p>
              <p className="mt-1 text-xl font-semibold text-white">
                {overview.total_flagged_sessions}
              </p>
            </div>
            <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-3">
              <p className="text-xs uppercase tracking-wide text-red-100/85">High risk</p>
              <p className="mt-1 text-xl font-semibold text-red-100">
                {overview.high_risk_sessions}
              </p>
            </div>
            <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3">
              <p className="text-xs uppercase tracking-wide text-amber-100/85">Medium risk</p>
              <p className="mt-1 text-xl font-semibold text-amber-100">
                {overview.medium_risk_sessions}
              </p>
            </div>
            <div className="rounded-xl border border-brand/40 bg-brand/10 p-3">
              <p className="text-xs uppercase tracking-wide text-brand-muted">Low risk</p>
              <p className="mt-1 text-xl font-semibold text-brand">
                {overview.low_risk_sessions}
              </p>
            </div>
          </div>

          {overview.top_risk_reasons.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/55">
                Top risk reasons
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {overview.top_risk_reasons.map((reason) => (
                  <span
                    key={reason}
                    className="rounded-full border border-border/70 bg-black/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/75"
                  >
                    {prettyReason(reason)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {leaderboard.risky_paths.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/55">
                Risky paths
              </p>
              <p className="mt-1 text-sm text-white/70">
                {leaderboard.risky_paths
                  .slice(0, 3)
                  .map((item) => `${item.path} (${item.count})`)
                  .join(" · ")}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
