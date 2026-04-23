import type { ChangeImpactResult } from "@/lib/db/change-impact";
import { DashboardSection } from "@/components/dashboard/DashboardSection";

type Props = {
  impacts: ChangeImpactResult[];
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function impactBadge(flag: string): string {
  if (flag === "traffic_spike") return "↑ traffic";
  if (flag === "traffic_drop") return "↓ traffic";
  if (flag === "uptime_impact") return "⚠ uptime";
  if (flag === "risk_change") return "🚨 risk";
  if (flag === "conversion_change") return "◎ conversion";
  return flag;
}

export function ChangeImpactCard({ impacts }: Props) {
  return (
    <DashboardSection
      kicker="Change log"
      title="What changed (and whether the internet cared)"
      subtitle="Deployments without notes are just vibes. This is the receipts section."
    >
      {impacts.length === 0 ? (
        <p className="text-sm text-slate-700">
          No deploy notes yet. Track changes so this can call out what mattered.
        </p>
      ) : (
        <ul className="max-h-[460px] space-y-3 overflow-y-auto pr-1">
          {impacts.map((impact) => (
            <li
              key={impact.change_log_id}
              className="rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">{impact.title}</p>
                  <p className="mt-1 text-xs text-slate-700">{impact.summary}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Sessions {impact.metrics.sessions_before} → {impact.metrics.sessions_after} (
                    {impact.metrics.sessions_percent_change > 0 ? "+" : ""}
                    {impact.metrics.sessions_percent_change.toFixed(1)}%)
                  </p>
                  {impact.flags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {impact.flags.map((flag) => (
                        <span
                          key={`${impact.change_log_id}-${flag}`}
                          className="rounded-full border border-slate-200/90 bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-800"
                        >
                          {impactBadge(flag)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <p className="shrink-0 text-xs text-slate-500">{timeAgo(impact.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}
