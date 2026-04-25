import type { DashboardGlobalSummary } from "@/lib/db/dashboard";

type Props = {
  summary: DashboardGlobalSummary;
};

function plural(value: number, one: string, many: string): string {
  return value === 1 ? one : many;
}

export function DashboardSummary({ summary }: Props) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-1 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.55)] sm:p-1.5">
      <div className="relative overflow-hidden rounded-[calc(1rem-3px)] bg-white p-5 sm:p-6">
        <div
          className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--brand)_18%,transparent),transparent_70%)] opacity-80"
          aria-hidden
        />
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Global status</p>
        <div className="relative mt-4 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">⚠ Needs attention</p>
            <p className="ui-kpi-value mt-1 text-slate-950 tabular-nums">{summary.sitesNeedingAttention}</p>
            <p className="mt-1 text-xs text-slate-600">
            {plural(summary.sitesNeedingAttention, "site has", "sites have")} active risk signals.
            </p>
          </article>
          <article className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">Regressions</p>
            <p className="ui-kpi-value mt-1 text-slate-950 tabular-nums">{summary.regressionsDetected}</p>
            <p className="mt-1 text-xs text-slate-600">
            {plural(summary.regressionsDetected, "site regressed", "sites regressed")} since the previous scan.
            </p>
          </article>
          <article className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Stable</p>
            <p className="ui-kpi-value mt-1 text-slate-950 tabular-nums">{summary.stableSites}</p>
            <p className="mt-1 text-xs text-slate-600">
            {plural(summary.stableSites, "site is", "sites are")} steady or improving.
            </p>
          </article>
        </div>
      {summary.sitesWithoutScans > 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          {summary.sitesWithoutScans}{" "}
          {plural(summary.sitesWithoutScans, "site has", "sites have")} no crawl report yet. Run a scan to light up
          full metrics.
        </p>
      ) : null}
      </div>
    </section>
  );
}
