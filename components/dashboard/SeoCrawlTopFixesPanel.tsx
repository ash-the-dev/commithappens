import type { SeoCrawlTopIssue } from "@/lib/db/seo-crawl-intelligence";

type Props = {
  issues: SeoCrawlTopIssue[];
};

function sevClass(sev: string): string {
  if (sev === "critical") return "border-rose-300/40 bg-rose-500/15 text-rose-100";
  if (sev === "warning") return "border-amber-300/40 bg-amber-500/12 text-amber-50";
  if (sev === "notice") return "border-sky-300/30 bg-sky-500/10 text-sky-100";
  return "border-white/20 bg-white/8 text-white/80";
}

export function SeoCrawlTopFixesPanel({ issues }: Props) {
  if (issues.length === 0) {
    return (
      <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-5 text-sm text-white/70">
        No high-priority issues in the last crawl, or the latest run only has healthy pages. Run a fresh import to refresh.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="ui-section-title text-white/55">Top fixes</p>
      <p className="text-xs text-white/55">Up to three of the most severe URLs from the latest stored crawl (rule-based).</p>
      <ul className="space-y-2">
        {issues.map((item) => (
          <li
            key={item.url}
            className="rounded-2xl border border-white/12 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${sevClass(item.issue_severity)}`}>
                {item.issue_severity} · {item.issue_type}
              </span>
              {item.status != null ? (
                <span className="text-[11px] text-white/50">HTTP {item.status}</span>
              ) : null}
            </div>
            <p className="mt-1 break-all text-sm font-medium text-white">
              {item.url}
            </p>
            {item.title ? <p className="mt-0.5 line-clamp-1 text-xs text-white/50">{item.title}</p> : null}
            {item.crawl_notes ? <p className="mt-1 text-xs text-white/65">{item.crawl_notes}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
