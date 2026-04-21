import type { WebsiteInsights } from "@/lib/db/insights";

type Props = {
  insights: WebsiteInsights;
};

const EMPTY_STATE_TEXT = "Not enough data yet to tell you what changed.";

function badgeClass(flag: string): string {
  if (
    flag.includes("downtime") ||
    flag.includes("slow_lcp") ||
    flag.includes("high_cls") ||
    flag.includes("high_inp")
  ) {
    return "border-red-400/40 bg-red-500/10 text-red-100";
  }
  if (flag.includes("spike")) {
    return "border-amber-400/40 bg-amber-500/10 text-amber-100";
  }
  return "border-border/70 bg-black/25 text-white/80";
}

function formatFlag(flag: string): string {
  return flag.replace(/_/g, " ");
}

export function SiteInsightsCard({ insights }: Props) {
  const hasData =
    insights.summary_text.trim() !== EMPTY_STATE_TEXT ||
    insights.key_points.length > 0 ||
    insights.detected_flags.length > 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-white/65">
        So... what happened?
      </h2>

      {!hasData ? (
        <p className="mt-4 text-sm text-white/55">
          {EMPTY_STATE_TEXT}
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-white/85">{insights.summary_text}</p>

          {insights.key_points.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {insights.key_points.map((point) => (
                <li
                  key={point}
                  className="rounded-xl border border-border/70 bg-black/25 px-3 py-2 text-sm text-white/75"
                >
                  {point}
                </li>
              ))}
            </ul>
          ) : null}

          {insights.detected_flags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {insights.detected_flags.slice(0, 6).map((flag) => (
                <span
                  key={flag}
                  className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${badgeClass(
                    flag,
                  )}`}
                >
                  {formatFlag(flag)}
                </span>
              ))}
            </div>
          ) : null}

          {insights.latest_anomaly ? (
            <div className="mt-5 rounded-xl border border-border/80 bg-black/25 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
                Anything weird happening?
              </p>
              <p className="mt-1 text-sm text-white/80">
                {insights.latest_anomaly.date}: {insights.latest_anomaly.metric_type}{" "}
                {insights.latest_anomaly.percent_change > 0 ? "+" : ""}
                {insights.latest_anomaly.percent_change.toFixed(1)}% vs baseline.
              </p>
              {insights.latest_spike_explanation?.factors[0] ? (
                <p className="mt-1 text-xs text-white/60">
                  Most likely reason: {insights.latest_spike_explanation.factors[0].label}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
