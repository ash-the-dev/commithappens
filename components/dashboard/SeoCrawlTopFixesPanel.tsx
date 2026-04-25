import type { SeoCrawlTopIssue } from "@/lib/db/seo-crawl-intelligence";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";
import { getIssueExplanation, getMetricExplanation } from "@/lib/seo/crawl/explanations";
import { getSeoRecommendation } from "@/lib/seo/recommendationCopy";

type Props = {
  issues: SeoCrawlTopIssue[];
};

const btn = "h-4 w-4 text-[8px] border-white/25 bg-white/5 text-white/90";

function sevClass(sev: string): string {
  if (sev === "critical") return "border-rose-300/40 bg-rose-500/15 text-rose-100";
  if (sev === "high") return "border-orange-300/40 bg-orange-500/15 text-orange-100";
  if (sev === "medium") return "border-amber-300/40 bg-amber-500/12 text-amber-50";
  if (sev === "low") return "border-sky-300/30 bg-sky-500/10 text-sky-100";
  if (sev === "warning") return "border-amber-300/40 bg-amber-500/12 text-amber-50";
  if (sev === "notice") return "border-sky-300/30 bg-sky-500/10 text-sky-100";
  return "border-white/20 bg-white/8 text-white/80";
}

function issueSeverityToPanel(sev: string): "critical" | "warning" | "notice" | "healthy" | "info" {
  if (sev === "critical") return "critical";
  if (sev === "high") return "warning";
  if (sev === "medium") return "notice";
  if (sev === "low") return "info";
  if (sev === "warning") return "warning";
  if (sev === "notice") return "notice";
  if (sev === "healthy") return "healthy";
  return "info";
}

function humanizeType(t: string): string {
  if (!t) return "Issue";
  return t.replaceAll("_", " ");
}

function PanelHeader() {
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="ui-section-title text-white/55">Top fixes</p>
      <InfoTooltip className="shrink-0" buttonClassName={btn} {...getMetricExplanation("top_fixes")} />
    </div>
  );
}

export function SeoCrawlTopFixesPanel({ issues }: Props) {
  if (issues.length === 0) {
    return (
      <div className="space-y-2">
        <PanelHeader />
        <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-5 text-sm text-white/70">
          No high-priority crawl drama right now. Run a fresh crawl if you don’t trust the silence.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PanelHeader />
      <p className="text-xs text-white/55">The three URLs most likely to make future-you sigh.</p>
      <ul className="space-y-3">
        {issues.map((item) => {
          const expl = getIssueExplanation(item.issue_type);
          const fallback = getSeoRecommendation(item.issue_type);
          const hasEnrichedCopy = Boolean(item.plainMeaning || item.whyItMatters || item.recommendedFix);
          const issueTitle = hasEnrichedCopy && item.title ? item.title : fallback.title;
          const plainMeaning = item.plainMeaning || item.description || fallback.plainMeaning;
          const whyItMatters = item.whyItMatters || fallback.whyItMatters;
          const recommendedFix = item.recommendedFix || item.recommendation || fallback.recommendedFix;
          const priorityLabel = item.priorityLabel || fallback.priorityLabel;
          const effort = item.effort || fallback.effort;
          return (
            <li
              key={`${item.issue_type}-${item.url}`}
              className="relative rounded-2xl border border-white/12 bg-linear-to-b from-white/8 to-white/2 p-3 pr-10"
            >
              <div className="absolute right-2 top-2 z-10">
                <InfoTooltip
                  buttonClassName={btn}
                  {...expl}
                  severity={issueSeverityToPanel(item.issue_severity)}
                  relatedIssueType={item.issue_type}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 pr-1">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${sevClass(
                    item.issue_severity,
                  )}`}
                >
                  {priorityLabel}
                </span>
                <span className="rounded-full border border-white/15 bg-white/6 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/65">
                  {item.issue_severity} · {humanizeType(item.issue_type)}
                </span>
                {item.status != null ? <span className="text-[11px] text-white/50">HTTP {item.status}</span> : null}
              </div>
              {item.internal_links_count != null ? (
                <p className="mt-1 text-[11px] text-white/45">
                  Out-links seen in crawl: {item.internal_links_count}
                  {item.internal_links_count === 0 ? " (we did not see any links in the payload)" : ""}
                </p>
              ) : null}
              <p className="mt-2 text-base font-semibold text-white">{issueTitle}</p>
              {item.url ? <p className="mt-1 break-all text-xs font-medium text-white/55">{item.url}</p> : null}
              {!hasEnrichedCopy && item.title ? (
                <p className="mt-0.5 line-clamp-1 text-xs text-white/50">Title: {item.title}</p>
              ) : null}
              <div className="mt-3 grid gap-2 text-xs leading-relaxed text-white/75">
                <div>
                  <p className="font-bold uppercase tracking-[0.12em] text-white/45">What it means</p>
                  <p className="mt-0.5">{plainMeaning}</p>
                </div>
                <div>
                  <p className="font-bold uppercase tracking-[0.12em] text-white/45">Why it matters</p>
                  <p className="mt-0.5">{whyItMatters}</p>
                </div>
                <div>
                  <p className="font-bold uppercase tracking-[0.12em] text-white/45">What to do next</p>
                  <p className="mt-0.5">{recommendedFix}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold uppercase tracking-[0.12em] text-white/45">Effort</span>
                  <span className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 font-semibold text-white/80">
                    {effort}
                  </span>
                </div>
              </div>
              {item.crawl_notes ? <p className="mt-1 text-xs text-white/60">{item.crawl_notes}</p> : null}
              {item.ownerHint ? <p className="mt-2 text-xs italic text-white/55">{item.ownerHint}</p> : null}
              {!item.description ? <p className="sr-only">{expl.definition}</p> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
