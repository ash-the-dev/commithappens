import type { WebsiteUptimeHistoryItem, WebsiteUptimeSnapshot } from "@/lib/db/uptime";

type Props = {
  snapshot: WebsiteUptimeSnapshot | null;
  history: WebsiteUptimeHistoryItem[];
  isFreeTier: boolean;
};

function statusTone(status: WebsiteUptimeSnapshot["status"] | WebsiteUptimeHistoryItem["status"]) {
  if (status === "up") return "text-emerald-200 border-emerald-300/40 bg-emerald-400/10";
  if (status === "degraded") return "text-amber-200 border-amber-300/40 bg-amber-400/10";
  if (status === "down" || status === "error")
    return "text-rose-200 border-rose-300/40 bg-rose-400/10";
  return "text-slate-200 border-slate-300/40 bg-slate-400/10";
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Not checked yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not checked yet";
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function UptimeMonitorCard({ snapshot, history, isFreeTier }: Props) {
  const currentStatus = snapshot?.status ?? "unknown";
  const cadence = snapshot?.frequencyMinutes ?? 30;
  return (
    <section className="ui-surface p-1 sm:p-1.5">
      <div className="relative overflow-hidden rounded-[calc(1rem-3px)] border border-white/[0.08] bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_20px_50px_-44px_rgba(0,0,0,0.85)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="ui-section-title text-white/55">Uptime monitor</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">Current status: {currentStatus}</h3>
          <p className="mt-1 text-xs text-white/65">
            Last checked {formatRelative(snapshot?.lastCheckedAt ?? null)} · every {cadence} minute
            {cadence === 1 ? "" : "s"}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(currentStatus)}`}>
          {currentStatus}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {(history.length === 0 ? [null] : history).map((row, idx) =>
          row ? (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/20 bg-black/20 px-3 py-2 text-xs text-white/75"
            >
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(row.status)}`}>
                {row.status}
              </span>
              <span>{formatRelative(row.checkedAt)}</span>
              <span>{row.statusCode ?? "n/a"}</span>
              <span>{row.responseTimeMs !== null ? `${row.responseTimeMs}ms` : "no timing"}</span>
            </div>
          ) : (
            <div
              key={`empty-${idx}`}
              className="rounded-2xl border border-white/20 bg-black/20 px-3 py-2 text-xs text-white/65"
            >
              No checks yet. The scheduler will populate this once the first run completes.
            </div>
          ),
        )}
      </div>

      {isFreeTier ? (
        <p className="mt-4 text-xs text-white/58">
          Free tier includes basic uptime status and recent checks. Upgrade to unlock richer historical monitoring
          views.
        </p>
      ) : null}
      </div>
    </section>
  );
}

