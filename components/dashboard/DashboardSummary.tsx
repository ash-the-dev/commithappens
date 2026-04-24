import type { DashboardGlobalSummary } from "@/lib/db/dashboard";

type Props = {
  summary: DashboardGlobalSummary;
};

function plural(value: number, one: string, many: string): string {
  return value === 1 ? one : many;
}

export function DashboardSummary({ summary }: Props) {
  return (
    <section className="rounded-3xl border border-white/20 bg-white/10 p-5 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.9)] backdrop-blur-xl sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">Global status</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-rose-300/30 bg-rose-400/10 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-rose-100/85">Needs attention</p>
          <p className="mt-2 text-2xl font-bold text-white">{summary.sitesNeedingAttention}</p>
          <p className="mt-1 text-xs text-rose-100/80">
            {plural(summary.sitesNeedingAttention, "site has", "sites have")} active risk signals.
          </p>
        </article>
        <article className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-amber-100/85">Regressions</p>
          <p className="mt-2 text-2xl font-bold text-white">{summary.regressionsDetected}</p>
          <p className="mt-1 text-xs text-amber-100/80">
            {plural(summary.regressionsDetected, "site regressed", "sites regressed")} since the previous scan.
          </p>
        </article>
        <article className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-emerald-100/85">Stable</p>
          <p className="mt-2 text-2xl font-bold text-white">{summary.stableSites}</p>
          <p className="mt-1 text-xs text-emerald-100/80">
            {plural(summary.stableSites, "site is", "sites are")} steady or improving.
          </p>
        </article>
      </div>
      {summary.sitesWithoutScans > 0 ? (
        <p className="mt-3 text-xs text-white/65">
          {summary.sitesWithoutScans}{" "}
          {plural(summary.sitesWithoutScans, "site has", "sites have")} no crawl report yet. Run a scan to light up
          full metrics.
        </p>
      ) : null}
    </section>
  );
}
