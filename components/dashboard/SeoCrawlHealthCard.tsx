import type { SeoCrawlRunRow } from "@/lib/db/seo-crawl-intelligence";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";
import { getMetricExplanation } from "@/lib/seo/crawl/explanations";

type Props = {
  run: SeoCrawlRunRow;
};

const btn = "h-4 w-4 text-[8px] border-slate-300 bg-slate-100 text-slate-700 hover:border-blue-300";

function scoreTone(score: number): string {
  if (score >= 85) return "text-blue-600";
  if (score >= 60) return "text-violet-600";
  return "text-amber-600";
}

export function SeoCrawlHealthCard({ run }: Props) {
  const d = new Date(run.created_at);
  const when = Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-US", { dateStyle: "medium" });
  const total = Math.max(1, run.healthy_count + run.notice_count + run.warning_count + run.critical_count);

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-1 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.55)] sm:p-1.5">
      <div className="relative overflow-hidden rounded-[calc(1rem-3px)] bg-white p-5 sm:p-6">
        <div className="absolute right-3 top-3 z-10 sm:right-4 sm:top-4">
          <InfoTooltip buttonClassName={btn} {...getMetricExplanation("site_health_score")} />
        </div>
        <p className="pr-8 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 sm:pr-9">Site health (crawl)</p>
        <p className={`mt-1 text-4xl font-bold tabular-nums tracking-tight ${scoreTone(run.health_score)}`}>
          {run.health_score}
        </p>
        <p className="mt-1 text-sm text-slate-600">Rule-based score from your latest import (0–100). Lower when issues add up.</p>
        <div className="mt-4 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
          <div className="flex h-3">
            <span
              className="bg-blue-500"
              style={{ width: `${(run.healthy_count / total) * 100}%` }}
              title={`${run.healthy_count} healthy`}
            />
            <span
              className="bg-cyan-400"
              style={{ width: `${(run.notice_count / total) * 100}%` }}
              title={`${run.notice_count} notices`}
            />
            <span
              className="bg-violet-500"
              style={{ width: `${(run.warning_count / total) * 100}%` }}
              title={`${run.warning_count} warnings`}
            />
            <span
              className="bg-amber-400"
              style={{ width: `${(run.critical_count / total) * 100}%` }}
              title={`${run.critical_count} critical`}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Visual mix: healthy vs notice/warning/critical. If the bar is all calm colors, enjoy the rare silence.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-1.5">
            <dt className="text-blue-700/70">Healthy</dt>
            <dd className="font-semibold tabular-nums text-blue-900">{run.healthy_count}</dd>
          </div>
          <div className="rounded-lg border border-cyan-100 bg-cyan-50 px-2 py-1.5">
            <dt className="text-cyan-700/70">Notice</dt>
            <dd className="font-semibold tabular-nums text-cyan-900">{run.notice_count}</dd>
          </div>
          <div className="rounded-lg border border-violet-100 bg-violet-50 px-2 py-1.5">
            <dt className="text-violet-700/70">Warning</dt>
            <dd className="font-semibold tabular-nums text-violet-900">{run.warning_count}</dd>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 px-2 py-1.5">
            <dt className="text-amber-700/70">Critical</dt>
            <dd className="font-semibold tabular-nums text-amber-900">{run.critical_count}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          Latest crawl: {when} · {run.pages_crawled} URL{run.pages_crawled === 1 ? "" : "s"} in run
        </p>
      </div>
    </article>
  );
}
