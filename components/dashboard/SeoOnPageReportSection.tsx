import { InfoTooltip } from "@/components/dashboard/InfoTooltip";
import { getMetricExplanation } from "@/lib/seo/crawl/explanations";
import type { SeoCrawlOnPageBreakdown } from "@/lib/db/seo-crawl-intelligence";

const tbtn = "h-4 w-4 min-h-4 min-w-4 border-slate-300 bg-slate-100 text-slate-700";

type Rec = { type: string; message?: string; priority: "high" | "medium" | "low" };

type Props = {
  breakdown: SeoCrawlOnPageBreakdown | null;
  /** When empty, a friendly “all quiet” or crawl-first prompt is shown. */
  priorityRecommendations: Rec[];
};

function StatLine(props: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 py-1.5 last:border-0">
      <span className="text-xs text-slate-500">{props.label}</span>
      <div className="shrink-0 text-right">
        <span className="text-sm font-semibold text-slate-950">{props.value}</span>
        {props.note ? <p className="mt-0.5 max-w-xs text-[0.7rem] text-slate-500">{props.note}</p> : null}
      </div>
    </div>
  );
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function CoverageBar(props: { label: string; value: number; note: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-slate-700">{props.label}</span>
        <span className="tabular-nums text-slate-500">{props.value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-linear-to-r from-blue-500 via-violet-500 to-pink-400"
          style={{ width: `${props.value}%` }}
        />
      </div>
      <p className="text-[0.7rem] text-slate-500">{props.note}</p>
    </div>
  );
}

/**
 * On-page, indexability, and content signals from the latest `seo_crawl_pages` import.
 * Renders even when the response-code import is the primary comparison surface.
 */
export function SeoOnPageReportSection({ breakdown, priorityRecommendations }: Props) {
  if (!breakdown) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-base font-semibold text-slate-950">On-page &amp; content (latest crawl import)</h3>
        <p className="mt-2 text-sm text-slate-600">
          Nothing page-level landed yet. When a crawl brings titles, metas, and links back to the database, this stops
          being a sad little empty box.
        </p>
      </div>
    );
  }

  const dupFromRules =
    (breakdown.byIssueType["duplicate_content"] ?? 0) + (breakdown.byIssueType["thin_content"] ?? 0);
  const missingBundle = breakdown.duplicateOrThinFlags;
  const pages = Math.max(0, breakdown.pagesCrawled);
  const titleCoverage = pct(breakdown.titlePresent, pages);
  const metaCoverage = pct(breakdown.metaPresent, pages);
  const h1Coverage = pct(breakdown.h1Present, pages);
  const linkDataCoverage = pct(breakdown.internalLinkPagesWithData, pages);
  const indexableCoverage = pct(breakdown.indexable2xx, pages);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">On-page, links, and indexability</h3>
          <p className="mt-1 text-sm text-slate-600">
            Pulled from your latest <span className="font-semibold text-slate-900">crawl import</span> (not the same file as
            every HTTP-only export). As of {new Date(breakdown.runCreatedAt ?? "").toLocaleString() || "this run"}.
          </p>
        </div>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          {breakdown.pagesCrawled} URLs in this run
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm md:col-span-2 sm:p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-950">Crawl category coverage</h4>
              <p className="mt-1 text-xs text-slate-600">
                If one category is empty, the dashboard starts looking suspicious. This shows what the latest import
                actually populated.
              </p>
            </div>
            <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700">
              {pages} URLs checked
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <CoverageBar label="Titles" value={titleCoverage} note={`${breakdown.titlePresent}/${pages} present`} />
            <CoverageBar label="Meta" value={metaCoverage} note={`${breakdown.metaPresent}/${pages} present`} />
            <CoverageBar label="H1s" value={h1Coverage} note={`${breakdown.h1Present}/${pages} present`} />
            <CoverageBar
              label="Links"
              value={linkDataCoverage}
              note={`${breakdown.internalLinkPagesWithData}/${pages} with link payloads`}
            />
            <CoverageBar label="2xx" value={indexableCoverage} note={`${breakdown.indexable2xx}/${pages} clean`} />
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-950">Page titles</h4>
            <InfoTooltip buttonClassName={tbtn} {...getMetricExplanation("onpage_titles")} />
          </div>
          <StatLine
            label="Present / missing"
            value={`${breakdown.titlePresent} ok · ${breakdown.titleMissing} missing`}
          />
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-950">Meta descriptions</h4>
            <InfoTooltip buttonClassName={tbtn} {...getMetricExplanation("onpage_meta")} />
          </div>
          <StatLine
            label="Present / missing"
            value={`${breakdown.metaPresent} ok · ${breakdown.metaMissing} missing`}
          />
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-950">H1 tags</h4>
            <InfoTooltip buttonClassName={tbtn} {...getMetricExplanation("onpage_h1")} />
          </div>
          <StatLine
            label="Present / missing"
            value={`${breakdown.h1Present} ok · ${breakdown.h1Missing} missing`}
          />
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-950">Internal links (crawl storage)</h4>
            <InfoTooltip buttonClassName={tbtn} {...getMetricExplanation("onpage_internal_links")} />
          </div>
          <StatLine
            label="Pages with link lists · avg out-links (where stored)"
            value={
              breakdown.internalLinksAvg != null
                ? `${breakdown.internalLinkPagesWithData} pages · ${breakdown.internalLinksAvg.toFixed(1)} avg`
                : `${breakdown.internalLinkPagesWithData} pages · n/a`
            }
            note="If this reads low, the import may not have included a link array for most URLs yet."
          />
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-950">Indexability (HTTP view)</h4>
            <InfoTooltip buttonClassName={tbtn} {...getMetricExplanation("onpage_indexability")} />
          </div>
          <StatLine
            label="2xx vs other / redirect bucket"
            value={`${breakdown.indexable2xx} clean · ${breakdown.notIndexable} not 2xx or unclear`}
          />
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-950">Broken or error pages</h4>
            <InfoTooltip buttonClassName={tbtn} {...getMetricExplanation("onpage_broken_links")} />
          </div>
          <StatLine label="Flagged in this run" value={`${breakdown.brokenPages} URLs`} />
        </article>

        <article className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 sm:col-span-2 sm:p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-950">Duplicate / missing content signals</h4>
            <InfoTooltip buttonClassName={tbtn} {...getMetricExplanation("onpage_missing_duplicate")} />
          </div>
          <p className="text-sm text-slate-600">
            Rule-based <span className="font-semibold text-slate-900">missing title / H1 / meta</span> flags:{" "}
            <span className="font-semibold text-amber-700">{missingBundle}</span> page
            {missingBundle === 1 ? "" : "s"}.{" "}
            {dupFromRules > 0 ? (
              <>
                Duplicate / thin rules: <span className="font-semibold text-amber-700">{dupFromRules}</span>.
              </>
            ) : (
              "No duplicate rules fired this time. Tiny miracle."
            )}
          </p>
        </article>
      </div>

      <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4 sm:p-5">
        <h4 className="text-sm font-semibold text-slate-950">Priority recommendations (from this report)</h4>
        <p className="mt-1 text-xs text-slate-500">
          Same list as the response-code engine — now paired with the on-page crawl readout above.
        </p>
        {priorityRecommendations.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            No high-priority rows right now. Enjoy the calm while it lasts.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {priorityRecommendations.map((r) => (
              <li
                key={`${r.type}-${r.message ?? ""}`}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
              >
                <span className="min-w-0">
                  {r.message ?? r.type}
                </span>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    r.priority === "high"
                      ? "border-amber-300 text-amber-700"
                      : r.priority === "medium"
                        ? "border-amber-300 text-amber-700"
                        : "border-blue-300 text-blue-700"
                  }`}
                >
                  {r.priority}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
