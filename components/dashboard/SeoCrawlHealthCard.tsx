import type { SeoCrawlRunRow } from "@/lib/db/seo-crawl-intelligence";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";
import { getMetricExplanation } from "@/lib/seo/crawl/explanations";

type Props = {
  run: SeoCrawlRunRow;
};

const btn = "h-4 w-4 text-[8px] border-white/25 bg-white/5 text-white/90 hover:border-white/40";

function scoreTone(score: number): string {
  if (score >= 85) return "text-emerald-200";
  if (score >= 60) return "text-amber-200";
  return "text-rose-200";
}

export function SeoCrawlHealthCard({ run }: Props) {
  const d = new Date(run.created_at);
  const when = Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-US", { dateStyle: "medium" });

  return (
    <article className="ui-surface p-1 sm:p-1.5">
      <div className="relative overflow-hidden rounded-[calc(1rem-3px)] border border-white/[0.08] bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-5 sm:p-6">
        <div className="absolute right-3 top-3 z-10 sm:right-4 sm:top-4">
          <InfoTooltip buttonClassName={btn} {...getMetricExplanation("site_health_score")} />
        </div>
        <p className="ui-section-title pr-8 text-white/55 sm:pr-9">Site health (crawl)</p>
        <p className={`mt-1 text-4xl font-bold tabular-nums tracking-tight ${scoreTone(run.health_score)}`}>
          {run.health_score}
        </p>
        <p className="mt-1 text-sm text-white/70">Rule-based score from your latest import (0–100). Lower when issues add up.</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-lg border border-white/15 bg-white/5 px-2 py-1.5">
            <dt className="text-white/50">Healthy</dt>
            <dd className="font-semibold tabular-nums text-white">{run.healthy_count}</dd>
          </div>
          <div className="rounded-lg border border-amber-300/20 bg-amber-500/10 px-2 py-1.5">
            <dt className="text-amber-100/80">Notice</dt>
            <dd className="font-semibold tabular-nums text-amber-50">{run.notice_count}</dd>
          </div>
          <div className="rounded-lg border border-orange-300/25 bg-orange-500/10 px-2 py-1.5">
            <dt className="text-orange-100/85">Warning</dt>
            <dd className="font-semibold tabular-nums text-orange-50">{run.warning_count}</dd>
          </div>
          <div className="rounded-lg border border-rose-300/30 bg-rose-500/10 px-2 py-1.5">
            <dt className="text-rose-100/85">Critical</dt>
            <dd className="font-semibold tabular-nums text-rose-50">{run.critical_count}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-white/50">
          Latest crawl: {when} · {run.pages_crawled} URL{run.pages_crawled === 1 ? "" : "s"} in run
        </p>
      </div>
    </article>
  );
}
