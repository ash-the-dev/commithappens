import type { FlaggedActivityItem } from "@/lib/db/threats";
import { DashboardSection } from "@/components/dashboard/DashboardSection";

type Props = {
  items: FlaggedActivityItem[];
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

function severityClass(severity: FlaggedActivityItem["severity"]): string {
  if (severity === "high") {
    return "border-rose-400/50 bg-rose-500/12 text-rose-950";
  }
  if (severity === "medium") {
    return "border-amber-400/50 bg-amber-500/12 text-amber-950";
  }
  return "border-fuchsia-400/45 bg-fuchsia-500/10 text-fuchsia-950";
}

export function FlaggedActivityCard({ items }: Props) {
  return (
    <DashboardSection
      kicker="Evidence"
      title="Anything acting cursed?"
      subtitle="A short list of the weirdest recent signals — not a judgment of your character."
    >
      {items.length === 0 ? (
        <p className="text-sm text-slate-700">No cursed energy detected. For now.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityClass(
                        item.severity,
                      )}`}
                    >
                      {item.severity}
                    </span>
                    <p className="truncate text-sm font-medium text-slate-950">{item.description}</p>
                  </div>
                  {item.path ? (
                    <p className="mt-1 truncate font-mono text-xs text-slate-600">{item.path}</p>
                  ) : item.event_name ? (
                    <p className="mt-1 truncate text-xs text-slate-600">
                      event: {item.event_name}
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 text-xs text-slate-500">{timeAgo(item.occurred_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}
