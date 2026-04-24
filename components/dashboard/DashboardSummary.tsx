import type { DashboardGlobalSummary } from "@/lib/db/dashboard";

type Props = {
  summary: DashboardGlobalSummary;
};

function plural(value: number, one: string, many: string): string {
  return value === 1 ? one : many;
}

export function DashboardSummary({ summary }: Props) {
  return (
    <section className="ui-surface p-1 sm:p-1.5">
      <div className="relative overflow-hidden rounded-[calc(1rem-3px)] border border-white/[0.09] bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_24px_60px_-48px_rgba(0,0,0,0.95)] backdrop-blur-sm sm:p-6">
        <div
          className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--brand)_18%,transparent),transparent_70%)] opacity-80"
          aria-hidden
        />
        <p className="ui-section-title text-white/50">Global status</p>
        <div className="relative mt-4 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-rose-300/25 bg-gradient-to-b from-rose-400/18 to-rose-950/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-100/90">Needs attention</p>
            <p className="ui-kpi-value mt-1 text-white tabular-nums">{summary.sitesNeedingAttention}</p>
            <p className="mt-1 text-xs text-rose-100/78">
            {plural(summary.sitesNeedingAttention, "site has", "sites have")} active risk signals.
            </p>
          </article>
          <article className="rounded-2xl border border-amber-300/25 bg-gradient-to-b from-amber-400/16 to-amber-950/15 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-100/90">Regressions</p>
            <p className="ui-kpi-value mt-1 text-white tabular-nums">{summary.regressionsDetected}</p>
            <p className="mt-1 text-xs text-amber-100/78">
            {plural(summary.regressionsDetected, "site regressed", "sites regressed")} since the previous scan.
            </p>
          </article>
          <article className="rounded-2xl border border-emerald-300/25 bg-gradient-to-b from-emerald-400/16 to-emerald-950/15 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100/90">Stable</p>
            <p className="ui-kpi-value mt-1 text-white tabular-nums">{summary.stableSites}</p>
            <p className="mt-1 text-xs text-emerald-100/78">
            {plural(summary.stableSites, "site is", "sites are")} steady or improving.
            </p>
          </article>
        </div>
      {summary.sitesWithoutScans > 0 ? (
        <p className="mt-3 text-xs text-white/60">
          {summary.sitesWithoutScans}{" "}
          {plural(summary.sitesWithoutScans, "site has", "sites have")} no crawl report yet. Run a scan to light up
          full metrics.
        </p>
      ) : null}
      </div>
    </section>
  );
}
