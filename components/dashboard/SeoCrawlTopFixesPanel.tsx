import type { SeoCrawlTopIssue } from "@/lib/db/seo-crawl-intelligence";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";
import { getIssueExplanation, getImprovementSuggestion, getMetricExplanation } from "@/lib/seo/crawl/explanations";

type Props = {
  issues: SeoCrawlTopIssue[];
};

const btn = "h-4 w-4 text-[8px] border-white/25 bg-white/5 text-white/90";

function sevClass(sev: string): string {
  if (sev === "critical") return "border-rose-300/40 bg-rose-500/15 text-rose-100";
  if (sev === "warning") return "border-amber-300/40 bg-amber-500/12 text-amber-50";
  if (sev === "notice") return "border-sky-300/30 bg-sky-500/10 text-sky-100";
  return "border-white/20 bg-white/8 text-white/80";
}

function issueSeverityToPanel(sev: string): "critical" | "warning" | "notice" | "healthy" | "info" {
  if (sev === "critical") return "critical";
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
          No high-priority issues in the last crawl, or the latest run only has healthy pages. Run a fresh import to
          refresh.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PanelHeader />
      <p className="text-xs text-white/55">Up to three of the most severe URLs from the latest stored crawl (rule-based).</p>
      <ul className="space-y-3">
        {issues.map((item) => {
          const expl = getIssueExplanation(item.issue_type);
          const suggestions = getImprovementSuggestion(item.issue_type, {
            url: item.url,
            status: item.status,
            title: item.title,
            meta_description: item.meta_description,
            h1: item.h1,
            internalLinksCount: item.internal_links_count,
          });
          return (
            <li
              key={item.url}
              className="relative rounded-2xl border border-white/12 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-3 pr-10"
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
              <p className="mt-1 break-all text-sm font-medium text-white">{item.url}</p>
              {item.title ? <p className="mt-0.5 line-clamp-1 text-xs text-white/50">Title: {item.title}</p> : null}
              <p className="mt-1.5 text-xs leading-relaxed text-white/80">{expl.definition}</p>
              {item.crawl_notes ? <p className="mt-1 text-xs text-white/60">{item.crawl_notes}</p> : null}
              {suggestions.length > 0 ? (
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-white/70">
                  {suggestions.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
