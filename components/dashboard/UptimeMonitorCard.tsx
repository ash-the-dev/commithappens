import type { WebsiteUptimeHistoryItem, WebsiteUptimeSnapshot } from "@/lib/db/uptime";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";
import { getMetricExplanation } from "@/lib/seo/crawl/explanations";
import { UptimeRefreshButton } from "@/components/dashboard/UptimeRefreshButton";

type Props = {
  siteId: string;
  snapshot: WebsiteUptimeSnapshot | null;
  history: WebsiteUptimeHistoryItem[];
};

function statusTone(status: WebsiteUptimeSnapshot["status"] | WebsiteUptimeHistoryItem["status"]) {
  if (status === "up") return "text-blue-700 border-blue-200 bg-blue-50";
  if (status === "down") return "text-amber-800 border-amber-300 bg-amber-50";
  return "text-slate-700 border-slate-200 bg-slate-50";
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

function tickTone(status: WebsiteUptimeHistoryItem["status"]): string {
  if (status === "up") return "bg-blue-500 shadow-[0_0_18px_rgba(59,130,246,0.45)]";
  return "bg-rose-500 shadow-[0_0_18px_rgba(244,63,94,0.45)]";
}

export function UptimeMonitorCard({ siteId, snapshot, history }: Props) {
  const currentStatus = snapshot?.status ?? "unknown";
  const cadence = snapshot?.frequencyMinutes ?? 30;
  const orderedHistory = history.slice(0, 50).reverse();
  const recentChecks = history.slice(0, 50);
  const visibleRows = history.slice(0, 8);
  const checksWithTiming = recentChecks.filter((row) => row.responseTimeMs != null);
  const avgResponse =
    checksWithTiming.length > 0
      ? Math.round(
          checksWithTiming.reduce((sum, row) => sum + (row.responseTimeMs ?? 0), 0) / checksWithTiming.length,
        )
      : null;
  const upCount = recentChecks.filter((row) => row.status === "up").length;
  const fallbackUptimePct = recentChecks.length > 0 ? (upCount / recentChecks.length) * 100 : null;
  const uptimePct = snapshot?.uptimePct24h ?? fallbackUptimePct;
  const latestResponse = snapshot?.lastResponseTimeMs ?? history[0]?.responseTimeMs ?? null;
  const latestStatusCode = snapshot?.lastStatusCode ?? history[0]?.statusCode ?? null;
  const tbtn = "h-4 w-4 min-h-4 min-w-4 text-[8px] border-slate-300 bg-slate-100 text-slate-700";
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-1 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.55)] sm:p-1.5">
      <div className="relative overflow-hidden rounded-[calc(1rem-3px)] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 pr-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Site Pulse</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
            Still Alive? {currentStatus === "up" ? "Yep." : currentStatus === "down" ? "Drama detected." : "Unknown."}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Last Check {formatRelative(snapshot?.lastCheckedAt ?? null)} · configured cadence {cadence} minute
            {cadence === 1 ? "" : "s"} when the runner is active
          </p>
          {snapshot?.monitorUrl ? (
            <p className="mt-1 max-w-xl truncate font-mono text-[11px] text-slate-400">{snapshot.monitorUrl}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <UptimeRefreshButton
            siteId={siteId}
            lastCheckedLabel={formatRelative(snapshot?.lastCheckedAt ?? null)}
            disabled={snapshot?.monitorEnabled === false}
          />
          <div className="flex items-center gap-1.5">
          <InfoTooltip buttonClassName={tbtn} {...getMetricExplanation("uptime")} />
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(currentStatus)}`}>
            {currentStatus}
          </span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-slate-500">Uptime Receipts</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">
            {uptimePct != null ? `${uptimePct.toFixed(1)}%` : "n/a"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {snapshot?.checks24h ? `Last 24h (${snapshot.checksUp24h}/${snapshot.checks24h})` : `Last ${recentChecks.length || 0} checks`}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="flex items-center gap-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-slate-500">
            <span>Response Time</span>
            <InfoTooltip buttonClassName={tbtn} {...getMetricExplanation("response_time")} />
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-950">
            {latestResponse != null ? `${latestResponse}ms` : "n/a"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {avgResponse != null ? `Avg ${avgResponse}ms over recent checks` : "No timings yet"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-slate-500">Downtime Drama</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{latestStatusCode ?? "n/a"}</p>
          <p className="mt-1 text-xs text-slate-500">
            {currentStatus === "down" ? "Something yelled. Go look." : "HTTP status from latest check"}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Uptime ticks</p>
          <p className="text-xs text-slate-500">Oldest → newest</p>
        </div>
        {orderedHistory.length > 0 ? (
          <div className="mt-4 flex items-end gap-1.5 overflow-x-auto pb-1">
            {orderedHistory.map((row) => (
              <div key={row.id} className="group flex min-w-3 flex-col items-center gap-1">
                <span
                  className={`h-8 w-2.5 rounded-full ${tickTone(row.status)}`}
                  title={`${row.status} · ${row.statusCode ?? "n/a"} · ${row.responseTimeMs ?? "no timing"}ms · ${formatRelative(row.checkedAt)}`}
                />
                <span className="sr-only">
                  {row.status} check {formatRelative(row.checkedAt)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
            No ticks yet. The runner may not be scheduled, or the site is brand new and still getting its shoes on.
          </p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Blue means up. Red means the site face-planted, timed out, or the URL failed safety checks.
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {history.length > 0 ? (
          <div className="mb-0.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-slate-200 pb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400 sm:text-[10px]">
            <span>Check</span>
            <span>When</span>
            <span className="inline-flex items-center gap-1">
              HTTP
              <InfoTooltip buttonClassName={tbtn} {...getMetricExplanation("http_status")} />
            </span>
            <span>Time (ms)</span>
          </div>
        ) : null}
        {(visibleRows.length === 0 ? [null] : visibleRows).map((row, idx) =>
          row ? (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
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
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500"
            >
              No checks yet. The uptime runner hasn’t shown up to work.
            </div>
          ),
        )}
      </div>
      </div>
    </section>
  );
}

