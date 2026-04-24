import { PremiumTeaserCard } from "@/components/dashboard/PremiumTeaserCard";
import { SeoCrawlHealthCard } from "@/components/dashboard/SeoCrawlHealthCard";
import { SeoCrawlTopFixesPanel } from "@/components/dashboard/SeoCrawlTopFixesPanel";
import type { SeoCrawlRunRow, SeoCrawlTopIssue } from "@/lib/db/seo-crawl-intelligence";

type Props = {
  latestRun: SeoCrawlRunRow | null;
  topIssues: SeoCrawlTopIssue[];
  isFree: boolean;
};

/**
 * Rule-based SEO crawl snapshot: health + top fixes. Free tier gets a teaser for deeper trend/Comparison tooling.
 */
export function SeoCrawlIntelligenceSection({ latestRun, topIssues, isFree }: Props) {
  if (!latestRun) {
    return (
      <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-8 text-center text-sm text-white/65">
        No crawl has been stored for this site yet. After you import a crawl (npm run seo:run), health and top fixes
        will show here.
      </div>
    );
  }

  return (
    <div className="space-y-5">
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
