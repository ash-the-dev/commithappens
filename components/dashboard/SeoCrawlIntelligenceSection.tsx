import { PremiumTeaserCard } from "@/components/dashboard/PremiumTeaserCard";
import { SeoCrawlHealthCard } from "@/components/dashboard/SeoCrawlHealthCard";
import { SeoCrawlTopFixesPanel } from "@/components/dashboard/SeoCrawlTopFixesPanel";
import { SeoReportRefreshButton } from "@/components/dashboard/SeoReportRefreshButton";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";
import { getMetricExplanation } from "@/lib/seo/crawl/explanations";
import type { SeoCrawlRunRow, SeoCrawlTopIssue } from "@/lib/db/seo-crawl-intelligence";

const tbtn = "h-4 w-4 min-h-4 min-w-4 text-[8px] border-white/25 bg-white/5 text-white/90";

type Props = {
  siteId: string;
  /** Mirrors `getBillingAccess().seoEnabled` (Committed dashboard re-import). */
  seoEnabled: boolean;
  latestRun: SeoCrawlRunRow | null;
  topIssues: SeoCrawlTopIssue[];
  isFree: boolean;
};

/**
 * Rule-based SEO crawl snapshot: health + top fixes. Free tier gets a teaser for deeper trend/Comparison tooling.
 */
export function SeoCrawlIntelligenceSection({ siteId, seoEnabled, latestRun, topIssues, isFree }: Props) {
  if (!latestRun) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <p className="min-w-0 text-xs text-white/70 sm:flex-1 sm:pr-2">
            <span className="font-semibold text-white/85">SEO crawl &amp; report</span> — no stored run for this site
            yet. Import a crawl, then use <span className="text-white/85">Refresh Report</span> to load the snapshot
            here.
          </p>
          <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto sm:justify-end">
            <InfoTooltip buttonClassName={tbtn} {...getMetricExplanation("seo_crawl_section")} />
            <SeoReportRefreshButton siteId={siteId} seoEnabled={seoEnabled} />
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-8 text-center text-sm text-white/65">
          No crawl has been stored for this site yet. After you import a crawl (npm run seo:run), health and top fixes
          will show here.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <p className="min-w-0 text-xs text-white/70 sm:flex-1 sm:pr-2">
          <span className="font-semibold text-white/85">SEO crawl &amp; report</span> — latest stored run, rule-based
          health, and top fixes. Use <span className="text-white/85">Refresh Report</span> to pull new data from the
          dashboard (Committed) or <span className="text-white/85">Reload snapshot</span> to refresh the view after a
          local import.
        </p>
        <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto sm:justify-end">
          <InfoTooltip buttonClassName={tbtn} {...getMetricExplanation("seo_crawl_section")} />
          <SeoReportRefreshButton siteId={siteId} seoEnabled={seoEnabled} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SeoCrawlHealthCard run={latestRun} />
        <div className="rounded-2xl border border-white/12 bg-white/5 p-5 sm:p-6">
          <SeoCrawlTopFixesPanel issues={topIssues} />
        </div>
      </div>
      {isFree ? (
        <PremiumTeaserCard
          href="/pricing"
          headline="Deeper SEO trends &amp; comparison"
          subtext="Upgrade for full response-code comparison charts, playbooks, and historical deltas. This snapshot uses your latest import only—no AI."
          ctaLabel="View plans"
        />
      ) : null}
    </div>
  );
}
