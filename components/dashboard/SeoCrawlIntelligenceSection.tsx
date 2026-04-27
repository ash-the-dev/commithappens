import { SeoCrawlHealthCard } from "@/components/dashboard/SeoCrawlHealthCard";
import { SeoCrawlTopFixesPanel } from "@/components/dashboard/SeoCrawlTopFixesPanel";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";
import { getMetricExplanation } from "@/lib/seo/crawl/explanations";
import type { SeoCrawlRunRow, SeoCrawlTopIssue } from "@/lib/db/seo-crawl-intelligence";

const tbtn = "h-4 w-4 min-h-4 min-w-4 text-[8px] border-slate-300 bg-slate-100 text-slate-700";

type Props = {
  latestRun: SeoCrawlRunRow | null;
  previousHealthScore?: number | null;
  topIssues: SeoCrawlTopIssue[];
  crawlStatus?: "ready" | "missing" | "running" | "failed";
  crawlErrorMessage?: string | null;
};

/**
 * Rule-based SEO crawl snapshot: health + top fixes.
 */
export function SeoCrawlIntelligenceSection({
  latestRun,
  previousHealthScore = null,
  topIssues,
  crawlStatus = "missing",
  crawlErrorMessage = null,
}: Props) {
  if (!latestRun) {
    const statusCopy =
      crawlStatus === "running"
        ? {
            label: "Crawl running",
            title: "Crawl running. The bot is still making its rounds.",
            body: "This should update shortly. Refresh Stats reloads stored data only; Run SEO Crawl starts a new crawl.",
          }
        : crawlStatus === "failed"
          ? {
              label: crawlErrorMessage?.toLowerCase().includes("timed out") ? "Crawl timed out" : "Crawl failed",
              title: crawlErrorMessage?.toLowerCase().includes("timed out")
                ? "The last crawl timed out before the report imported."
                : "The last crawl failed before it saved a usable report.",
              body: crawlErrorMessage ?? "Use Run SEO Crawl above to try again. We will not fake a baseline from bad data.",
            }
          : {
              label: "No crawl yet",
              title: "Nothing crawled yet. The bot hasn’t earned its keep.",
              body: "Run SEO Crawl checks this site and saves page-level SEO data. Refresh Stats only reloads stored reports after the crawl has finished importing.",
            };
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <p className="min-w-0 text-xs text-slate-600 sm:flex-1 sm:pr-2">
            <span className="font-semibold text-slate-900">SEO crawl &amp; report</span> — {statusCopy.label}
          </p>
          <div className="flex w-full shrink-0 items-center justify-end gap-3 sm:w-auto sm:justify-end">
            <InfoTooltip buttonClassName={tbtn} {...getMetricExplanation("seo_crawl_section")} />
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          <p className="font-semibold text-slate-900">{statusCopy.title}</p>
          <p className="mt-2">{statusCopy.body}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <p className="min-w-0 text-xs text-slate-600 sm:flex-1 sm:pr-2">
          <span className="font-semibold text-slate-900">SEO crawl &amp; report</span> — No drama. This crawl moved in
          the right direction. You’re stabilizing.
        </p>
        <div className="flex w-full shrink-0 items-center justify-end gap-3 sm:w-auto sm:justify-end">
          <InfoTooltip buttonClassName={tbtn} {...getMetricExplanation("seo_crawl_section")} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SeoCrawlHealthCard run={latestRun} previousHealthScore={previousHealthScore} />
        <div className="rounded-2xl border border-slate-900 bg-slate-950 p-5 shadow-sm sm:p-6">
          <SeoCrawlTopFixesPanel issues={topIssues} />
        </div>
      </div>
    </div>
  );
}
