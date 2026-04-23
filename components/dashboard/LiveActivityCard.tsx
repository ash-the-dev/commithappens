import type { SiteLiveActivityItem } from "@/lib/db/analytics";
import { DashboardSection } from "@/components/dashboard/DashboardSection";

type Props = {
  items: SiteLiveActivityItem[];
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

export function LiveActivityCard({ items }: Props) {
  return (
    <DashboardSection
      kicker="Live"
      title="What just happened"
      subtitle="Fresh pageviews and events — the ‘is it working?’ heartbeat."
    >
      {items.length === 0 ? (
        <p className="text-sm text-slate-700">Quiet. Either it’s calm, or the snippet isn’t where you think it is.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={`${item.type}-${item.id}`}
              className="rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        item.type === "pageview"
                          ? "rounded-full border border-fuchsia-300/55 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-950"
                          : "rounded-full border border-sky-300/55 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-950"
                      }
                    >
                      {item.type}
                    </span>
                    <p className="truncate text-sm font-medium text-slate-950">
                      {item.label}
                    </p>
                  </div>
                  {item.path ? (
                    <p className="mt-1 truncate font-mono text-xs text-slate-600">
                      {item.path}
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 text-xs text-slate-500">{timeAgo(item.occurredAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}
