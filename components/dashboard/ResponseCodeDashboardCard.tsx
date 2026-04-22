"use client";

import { useEffect, useMemo, useState } from "react";
import { buildResponseCodeVoice } from "@/lib/seo-voice/responseCodeVoice";

type ResponseCodeReportLike = {
  raw: {
    summary: {
      totalUrls: number;
      healthy: number;
      redirects: number;
      clientErrors: number;
      serverErrors: number;
      other: number;
    };
    rows: Array<{ url?: string; statusCode?: number; status?: string }>;
  };
  insights: {
    overview: {
      totalUrls: number;
      issuesFound: number;
      criticalCount: number;
      warningCount: number;
      healthScore: number;
    };
    recommendations: Array<{ type: string; priority: "high" | "medium" | "low" }>;
  };
  voice: {
    headline: string;
    subheadline: string;
    summary: string;
    statusLabel: "healthy" | "warning" | "critical" | "empty";
    issueHighlights: string[];
    recommendationMessages: string[];
    emptyStateMessage: string;
  };
};

function statusPillClass(status: ResponseCodeReportLike["voice"]["statusLabel"]): string {
  if (status === "critical") {
    return "border-rose-400/35 bg-rose-500/15 text-rose-100";
  }
  if (status === "warning") {
    return "border-amber-400/40 bg-amber-500/15 text-amber-100";
  }
  if (status === "healthy") {
    return "border-emerald-400/35 bg-emerald-500/15 text-emerald-100";
  }
  return "border-slate-300/20 bg-slate-400/10 text-slate-100";
}

function summaryAccentClass(label: "total" | "issues" | "critical" | "warning"): string {
  if (label === "critical") return "text-rose-300";
  if (label === "warning") return "text-amber-300";
  if (label === "issues") return "text-fuchsia-200";
  return "text-cyan-200";
}

function recommendationPill(priority: "high" | "medium" | "low"): string {
  if (priority === "high") return "border-rose-400/40 bg-rose-500/15 text-rose-100";
  if (priority === "medium") return "border-amber-400/40 bg-amber-500/15 text-amber-100";
  return "border-slate-300/30 bg-slate-300/10 text-slate-100";
}

function fallbackReport(): ResponseCodeReportLike {
  const emptyInsights = {
    overview: {
      totalUrls: 0,
      issuesFound: 0,
      criticalCount: 0,
      warningCount: 0,
      healthScore: 0,
    },
    priorityGroups: {
      critical: [],
      warning: [],
    },
    topIssues: [],
    recommendations: [],
  };

  return {
    raw: {
      summary: {
        totalUrls: 0,
        healthy: 0,
        redirects: 0,
        clientErrors: 0,
        serverErrors: 0,
        other: 0,
      },
      rows: [],
    },
    insights: emptyInsights,
    voice: buildResponseCodeVoice(emptyInsights),
  };
}

export function ResponseCodeDashboardCard() {
  const [report, setReport] = useState<ResponseCodeReportLike | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetchError, setHasFetchError] = useState(false);

  const emptyReport = useMemo(() => fallbackReport(), []);

  useEffect(() => {
    let isCancelled = false;

    async function fetchReport() {
      try {
        const res = await fetch("/api/seo/response-codes", { method: "GET" });
        if (!res.ok) {
          throw new Error(`Failed to load report: ${res.status}`);
        }
        const data = (await res.json()) as ResponseCodeReportLike;
        if (!isCancelled) {
          setReport(data);
          setHasFetchError(false);
        }
      } catch (err) {
        console.error("[seo][response-codes] fetch failed", err);
        if (!isCancelled) {
          setReport(emptyReport);
          setHasFetchError(true);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetchReport();
    return () => {
      isCancelled = true;
    };
  }, [emptyReport]);

  if (isLoading) {
    return (
      <section className="ui-dash-shell p-5 sm:p-6">
        <div className="rounded-3xl border border-white/15 bg-slate-950/50 p-8 text-center backdrop-blur-xl">
          <p className="text-sm font-semibold text-slate-200">Running analysis...</p>
        </div>
      </section>
    );
  }

  const resolvedReport = report ?? emptyReport;
  const { voice, insights, raw } = resolvedReport;

  if (voice.statusLabel === "empty") {
    return (
      <section className="ui-dash-shell p-5 sm:p-6">
        <div className="rounded-3xl border border-white/15 bg-slate-950/50 p-6 backdrop-blur-xl sm:p-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300/80">
              Response code report
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-100">{voice.headline}</h2>
            <p className="mt-2 text-sm text-slate-300">{voice.subheadline}</p>
            <p className="mt-4 text-sm text-slate-200/90">{voice.emptyStateMessage}</p>
            {hasFetchError ? (
              <p className="mt-4 text-xs text-slate-400">
                Could not load the latest report right now.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  const recommendationRows = voice.recommendationMessages.map((message, index) => {
    const priority = insights.recommendations[index]?.priority ?? "low";
    return { message, priority };
  });

  return (
    <section className="ui-dash-shell p-5 sm:p-6">
      <div className="space-y-5">
        <div className="rounded-3xl border border-white/15 bg-linear-to-br from-slate-900/80 via-slate-900/70 to-slate-950/85 p-6 shadow-[0_24px_65px_-38px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300/80">
                Response code report
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
                {voice.headline}
              </h2>
              <p className="mt-2 text-sm text-slate-300 sm:text-base">{voice.subheadline}</p>
            </div>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.13em] ${statusPillClass(
                voice.statusLabel,
              )}`}
            >
              {voice.statusLabel}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-4">
            <p className="max-w-3xl text-sm leading-relaxed text-slate-200/95">{voice.summary}</p>
            <div className="rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-3 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-cyan-100/80">
                Health score
              </p>
              <p className="mt-1 text-3xl font-bold text-cyan-100">{insights.overview.healthScore}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              key: "total" as const,
              label: "Total URLs",
              value: insights.overview.totalUrls,
              icon: "🌐",
            },
            {
              key: "issues" as const,
              label: "Issues Found",
              value: insights.overview.issuesFound,
              icon: "🧩",
            },
            {
              key: "critical" as const,
              label: "Critical Issues",
              value: insights.overview.criticalCount,
              icon: "⛔",
            },
            {
              key: "warning" as const,
              label: "Warnings",
              value: insights.overview.warningCount,
              icon: "⚠️",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/12 bg-slate-900/55 p-4 shadow-[0_18px_45px_-35px_rgba(0,0,0,0.9)] backdrop-blur-lg"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300/80">
                {item.icon} {item.label}
              </p>
              <p className={`mt-2 text-3xl font-bold ${summaryAccentClass(item.key)}`}>{item.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-white/12 bg-slate-900/55 p-5 backdrop-blur-lg">
            <h3 className="text-lg font-semibold text-slate-100">Here&apos;s what broke</h3>
            <ul className="mt-4 space-y-2">
              {voice.issueHighlights.length > 0 ? (
                voice.issueHighlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="rounded-xl border border-amber-400/20 bg-slate-950/45 px-3 py-2 text-sm text-slate-200"
                  >
                    <span className="mr-2">⚠️</span>
                    {highlight}
                  </li>
                ))
              ) : (
                <li className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                  No major highlights right now. Keep shipping.
                </li>
              )}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/12 bg-slate-900/55 p-5 backdrop-blur-lg">
            <h3 className="text-lg font-semibold text-slate-100">What to fix first</h3>
            <ul className="mt-4 space-y-2">
              {recommendationRows.length > 0 ? (
                recommendationRows.map((item) => (
                  <li
                    key={`${item.priority}:${item.message}`}
                    className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2 text-sm text-slate-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="leading-relaxed">{item.message}</p>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${recommendationPill(
                          item.priority,
                        )}`}
                      >
                        {item.priority}
                      </span>
                    </div>
                  </li>
                ))
              ) : (
                <li className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                  No fixes queued. This is suspiciously healthy.
                </li>
              )}
            </ul>
          </div>
        </div>

        <details className="rounded-2xl border border-white/12 bg-slate-900/45 p-4 backdrop-blur-lg">
          <summary className="cursor-pointer text-sm font-semibold text-slate-100">
            Show technical details
          </summary>
          <div className="mt-4 space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-200">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Healthy (2xx)</p>
                <p className="mt-1 text-lg font-semibold">{raw.summary.healthy}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-200">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Redirects (3xx)</p>
                <p className="mt-1 text-lg font-semibold">{raw.summary.redirects}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-200">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Client errors (4xx)</p>
                <p className="mt-1 text-lg font-semibold">{raw.summary.clientErrors}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-200">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Server errors (5xx)</p>
                <p className="mt-1 text-lg font-semibold">{raw.summary.serverErrors}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-200">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Other</p>
                <p className="mt-1 text-lg font-semibold">{raw.summary.other}</p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                URL preview
              </p>
              <ul className="mt-2 space-y-1">
                {raw.rows.length > 0 ? (
                  raw.rows.slice(0, 5).map((row, idx) => (
                    <li key={`${row.url ?? "row"}-${idx}`} className="text-sm text-slate-200">
                      <span className="font-semibold text-slate-100">{row.statusCode ?? "n/a"}</span>{" "}
                      <span className="text-slate-300">{row.status ?? ""}</span>{" "}
                      <span className="text-slate-400">{row.url ?? ""}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-slate-300">No URL rows available yet.</li>
                )}
              </ul>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
