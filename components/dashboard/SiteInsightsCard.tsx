import type { WebsiteInsights } from "@/lib/db/insights";
import { DashboardSection } from "@/components/dashboard/DashboardSection";

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
    return "border-rose-400/45 bg-rose-500/10 text-rose-900";
  }
  if (flag.includes("spike")) {
    return "border-amber-400/45 bg-amber-500/10 text-amber-950";
  }
  return "border-slate-200/90 bg-white/70 text-slate-800";
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
    <DashboardSection
      kicker="Situation report"
      title="So… what happened?"
      subtitle="Plain-English read on what moved, what looks off, and what deserves your attention — without pretending correlation is destiny."
    >
      {!hasData ? (
        <p className="text-sm text-slate-700">{EMPTY_STATE_TEXT}</p>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">The takeaway</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">{insights.summary_text}</p>
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-semibold">Why it matters:</span> this is the fastest way to notice “we shipped
              something and the world responded weirdly.”
            </p>
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-semibold">Do this next:</span> if anything feels spicy, scroll to alerts + change
              history — don’t panic-tweak SEO at 2am unless you enjoy suffering.
            </p>
          </div>

          {insights.key_points.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {insights.key_points.map((point) => (
                <li
                  key={point}
                  className="rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-2 text-sm text-slate-800"
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
            <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                Anything weird?
              </p>
              <p className="mt-2 text-sm text-slate-900">
                <span className="font-semibold">What happened:</span> on {insights.latest_anomaly.date},{" "}
                <span className="font-semibold">{insights.latest_anomaly.metric_type}</span> moved{" "}
                {insights.latest_anomaly.percent_change > 0 ? "+" : ""}
                {insights.latest_anomaly.percent_change.toFixed(1)}% vs baseline.
              </p>
              {insights.latest_spike_explanation?.factors[0] ? (
                <p className="mt-2 text-sm text-slate-700">
                  <span className="font-semibold">Most likely reason:</span>{" "}
                  {insights.latest_spike_explanation.factors[0].label}
                </p>
              ) : null}
              <p className="mt-2 text-sm text-slate-700">
                <span className="font-semibold">Do this next:</span> open the spike card below — it’s literally built
                for “why did this go brrrr.”
              </p>
            </div>
          ) : null}
        </>
      )}
    </DashboardSection>
  );
}
