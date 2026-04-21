import type { ChangeImpactResult } from "@/lib/db/change-impact";

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
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-white/65">
        What changed
      </h2>
      {impacts.length === 0 ? (
        <p className="mt-4 text-sm text-white/55">No deploy notes yet. Track changes so this can call out what mattered.</p>
      ) : (
        <ul className="mt-4 max-h-[460px] space-y-3 overflow-y-auto pr-1">
          {impacts.map((impact) => (
            <li
              key={impact.change_log_id}
              className="rounded-xl border border-border/70 bg-black/25 px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{impact.title}</p>
                  <p className="mt-1 text-xs text-white/60">{impact.summary}</p>
                  <p className="mt-1 text-xs text-white/45">
                    Sessions {impact.metrics.sessions_before} → {impact.metrics.sessions_after} (
                    {impact.metrics.sessions_percent_change > 0 ? "+" : ""}
                    {impact.metrics.sessions_percent_change.toFixed(1)}%)
                  </p>
                  {impact.flags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {impact.flags.map((flag) => (
                        <span
                          key={`${impact.change_log_id}-${flag}`}
                          className="rounded-full border border-border/70 bg-black/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/75"
                        >
                          {impactBadge(flag)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <p className="shrink-0 text-xs text-white/50">{timeAgo(impact.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
