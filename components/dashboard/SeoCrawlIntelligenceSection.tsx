import { SeoCrawlHealthCard } from "@/components/dashboard/SeoCrawlHealthCard";
import { SeoCrawlTopFixesPanel } from "@/components/dashboard/SeoCrawlTopFixesPanel";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";
import { getMetricExplanation } from "@/lib/seo/crawl/explanations";
import type { SeoCrawlRunRow, SeoCrawlTopIssue } from "@/lib/db/seo-crawl-intelligence";
import { SeoReportRefreshButton } from "@/components/dashboard/SeoReportRefreshButton";

const tbtn = "h-4 w-4 min-h-4 min-w-4 text-[8px] border-slate-300 bg-slate-100 text-slate-700";

type Props = {
  siteId: string;
  seoEnabled: boolean;
  crawlUnavailableReason?: string | null;
  latestRun: SeoCrawlRunRow | null;
  topIssues: SeoCrawlTopIssue[];
};

/**
 * Rule-based SEO crawl snapshot: health + top fixes.
 */
export function SeoCrawlIntelligenceSection({
  siteId,
  seoEnabled,
  crawlUnavailableReason = null,
  latestRun,
  topIssues,
}: Props) {
  if (!latestRun) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <p className="min-w-0 text-xs text-slate-600 sm:flex-1 sm:pr-2">
            <span className="font-semibold text-slate-900">SEO crawl &amp; report</span> — no stored run for this site
            yet. Run SEO Crawl sends the bot out. Refresh Stats just reloads what we already know.
          </p>
          <div className="flex w-full shrink-0 items-center justify-end gap-3 sm:w-auto sm:justify-end">
            <InfoTooltip buttonClassName={tbtn} {...getMetricExplanation("seo_crawl_section")} />
            <SeoReportRefreshButton
              siteId={siteId}
              seoEnabled={seoEnabled}
              crawlUnavailableReason={crawlUnavailableReason}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Nothing crawled yet. The bot hasn’t earned its keep.</p>
          <p className="mt-2">
            Run SEO Crawl sends the crawl worker to check the site. Refresh Stats reloads stored reports once the webhook
            finishes saving the useful stuff.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <p className="min-w-0 text-xs text-slate-600 sm:flex-1 sm:pr-2">
          <span className="font-semibold text-slate-900">SEO crawl &amp; report</span> — latest stored run, health score,
          and the first fixes worth touching.
        </p>
        <div className="flex w-full shrink-0 items-center justify-end gap-3 sm:w-auto sm:justify-end">
          <InfoTooltip buttonClassName={tbtn} {...getMetricExplanation("seo_crawl_section")} />
          <SeoReportRefreshButton
            siteId={siteId}
            seoEnabled={seoEnabled}
            crawlUnavailableReason={crawlUnavailableReason}
          />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SeoCrawlHealthCard run={latestRun} />
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <SeoCrawlTopFixesPanel issues={topIssues} />
        </div>
      </div>
    </div>
  );
}
