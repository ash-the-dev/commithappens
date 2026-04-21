import type { SiteLiveActivityItem } from "@/lib/db/analytics";

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
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-white/65">
        What just happened
      </h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-white/55">Quiet right now. Give it a minute.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li
              key={`${item.type}-${item.id}`}
              className="rounded-xl border border-border/70 bg-black/25 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        item.type === "pageview"
                          ? "rounded-full bg-brand/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand"
                          : "rounded-full bg-(--wave-blue)/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-(--wave-blue)"
                      }
                    >
                      {item.type}
                    </span>
                    <p className="truncate text-sm font-medium text-white">
                      {item.label}
                    </p>
                  </div>
                  {item.path ? (
                    <p className="mt-1 truncate font-mono text-xs text-white/55">
                      {item.path}
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 text-xs text-white/50">{timeAgo(item.occurredAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
