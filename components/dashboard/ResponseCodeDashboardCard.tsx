"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildResponseCodeVoice } from "@/lib/seo-voice/responseCodeVoice";
import type { ResponseCodeComparison } from "@/lib/seo/report/comparison";
import { getSeoPlaybookResponse, type SeoPlaybookIssueKey } from "@/lib/seo/playbook/responses";
import { runSeoResponseCodesImportFromDashboard } from "@/lib/seo/response-codes/seo-response-codes-run-client";
import { SeoOnPageReportSection } from "@/components/dashboard/SeoOnPageReportSection";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";
import { getMetricExplanation } from "@/lib/seo/crawl/explanations";
import type { SeoCrawlOnPageBreakdown } from "@/lib/db/seo-crawl-intelligence";

const metricInfoBtn = "h-3.5 w-3.5 min-h-3.5 min-w-3.5 border-slate-400/60 bg-slate-200/80 text-slate-800";

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
    issues?: Array<{ issueTitle?: string; category?: string }>;
  };
  insights: {
    overview: {
      totalUrls: number;
      issuesFound: number;
      criticalCount: number;
      warningCount: number;
      healthScore: number;
    };
    recommendations: Array<{ type: string; priority: "high" | "medium" | "low"; message?: string }>;
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

type ResponseCodeEnvelope = {
  current: ResponseCodeReportLike;
  previous: ResponseCodeReportLike | null;
  comparison: ResponseCodeComparison;
  // Backward compatibility fields may still exist on payload.
  raw?: ResponseCodeReportLike["raw"];
  insights?: ResponseCodeReportLike["insights"];
  voice?: ResponseCodeReportLike["voice"];
};

type Props = {
  siteId?: string;
  /**
   * Latest crawl on-page rollups; safe to pass null.
   * When null, the on-page section explains what is missing without touching response-code data.
   */
  onPageBreakdown?: SeoCrawlOnPageBreakdown | null;
};

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#94a3b8"];
const RUNNING_LINES = [
  "Let the chaos begin...",
  "Crunching numbers and a few feelings...",
  "Almost there. Probably.",
  "Taking a bit longer. That's usually a good sign.",
  "Building your report...",
] as const;

function trendPill(trend: "better" | "worse" | "stable" | "n/a"): string {
  if (trend === "better") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (trend === "worse") return "bg-rose-100 text-rose-700 border-rose-200";
  if (trend === "stable") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function priorityPill(priority: "high" | "medium" | "low"): string {
  if (priority === "high") return "bg-rose-100 text-rose-700 border-rose-200";
  if (priority === "medium") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
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
      issues: [],
    },
    insights: emptyInsights,
    voice: buildResponseCodeVoice(emptyInsights),
  };
}

function fallbackComparison(): ResponseCodeComparison {
  return {
    hasPrevious: false,
    overview: {
      headline: "No comparison yet.",
      summary: "Run another crawl to unlock trend intelligence.",
      currentCrawlDate: null,
      previousCrawlDate: null,
    },
    deltas: {
      totalPages: {
        key: "totalPages",
        label: "Pages crawled",
        current: 0,
        previous: 0,
        delta: 0,
        deltaPercent: null,
        trend: "n/a",
      },
      statusBuckets: {
        healthy2xx: 0,
        redirects3xx: 0,
        clientErrors4xx: 0,
        serverErrors5xx: 0,
        unknown: 0,
        previous: { healthy2xx: 0, redirects3xx: 0, clientErrors4xx: 0, serverErrors5xx: 0, unknown: 0 },
        delta: { healthy2xx: 0, redirects3xx: 0, clientErrors4xx: 0, serverErrors5xx: 0, unknown: 0 },
      },
      issuesFound: {
        key: "issuesFound",
        label: "Issues found",
        current: 0,
        previous: 0,
        delta: 0,
        deltaPercent: null,
        trend: "n/a",
      },
      healthScore: {
        key: "healthScore",
        label: "Health score",
        current: 0,
        previous: 0,
        delta: 0,
        deltaPercent: null,
        trend: "n/a",
      },
      newIssues: 0,
      resolvedIssues: 0,
    },
    regressions: [],
    improvements: [],
    unchanged: [],
    recommendationChanges: { added: [], removed: [] },
    actionItems: [],
  };
}

function asEnvelope(input: unknown): ResponseCodeEnvelope {
  const fallback = fallbackReport();
  const fbComp = fallbackComparison();
  if (!input || typeof input !== "object") {
    return { current: fallback, previous: null, comparison: fbComp };
  }
  const candidate = input as ResponseCodeEnvelope;
  if (candidate.current && candidate.comparison) {
    return {
      current: candidate.current,
      previous: candidate.previous ?? null,
      comparison: candidate.comparison ?? fbComp,
    };
  }
  if (candidate.raw && candidate.insights && candidate.voice) {
    return {
      current: candidate as ResponseCodeReportLike,
      previous: null,
      comparison: fbComp,
    };
  }
  return { current: fallback, previous: null, comparison: fbComp };
}

type MetricCardProps = {
  label: string;
  value: number;
  previous: number;
  delta: number;
  trend: "better" | "worse" | "stable" | "n/a";
  help: string;
  infoKey?: string;
};

function MetricCard({ label, value, previous, delta, trend, help, infoKey }: MetricCardProps) {
  const expl = infoKey ? getMetricExplanation(infoKey) : null;
  return (
    <article className="rounded-2xl border border-white/45 bg-white/90 p-4 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.65)]">
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        {expl ? <InfoTooltip buttonClassName={metricInfoBtn} {...expl} /> : null}
      </div>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">Previous: {previous}</p>
      <div className="mt-3 flex items-center gap-2">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${trendPill(trend)}`}>
          {trend}
        </span>
        <span className="text-xs font-medium text-slate-600">{delta > 0 ? `+${delta}` : delta}</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{help}</p>
    </article>
  );
}

function issueGuides(current: ResponseCodeReportLike) {
  const s = current.raw.summary;
  const byKey: Record<SeoPlaybookIssueKey, number> = {
    "404": s.clientErrors,
    "5xx": s.serverErrors,
    redirects: s.redirects,
    missing_titles: 0,
    missing_meta: 0,
    missing_h1: 0,
    thin_content: 0,
    duplicate_content: 0,
    unknown_crawl_issues: s.other,
    healthy_pages: s.healthy,
    regression: 0,
    improvement: 0,
  };

  const keys: SeoPlaybookIssueKey[] = [
    "404",
    "5xx",
    "redirects",
    "missing_titles",
    "missing_meta",
    "missing_h1",
    "thin_content",
    "duplicate_content",
    "unknown_crawl_issues",
    "healthy_pages",
  ];

  return keys.map((key) => {
    const playbook = getSeoPlaybookResponse(key);
    return {
      key,
      label: playbook.title,
      count: byKey[key],
      playfulMessage: playbook.playfulMessage,
      why: playbook.whyItMatters,
      fixSteps: playbook.actionableFixSteps,
      severity: playbook.severity,
    };
  });
}

export function ResponseCodeDashboardCard({ siteId = "default", onPageBreakdown = null }: Props) {
  const [envelope, setEnvelope] = useState<ResponseCodeEnvelope | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetchError, setHasFetchError] = useState(false);
  const [isRunningCrawl, setIsRunningCrawl] = useState(false);
  const [crawlStartedAt, setCrawlStartedAt] = useState<number | null>(null);
  const [crawlElapsedSec, setCrawlElapsedSec] = useState(0);
  const [runningLineIdx, setRunningLineIdx] = useState(0);
  const [runStatusMessage, setRunStatusMessage] = useState<string | null>(null);
  const [runErrorMessage, setRunErrorMessage] = useState<string | null>(null);

  const empty = useMemo(() => ({ current: fallbackReport(), previous: null, comparison: fallbackComparison() }), []);

  const fetchReport = useCallback(async () => {
    try {
      const res = await fetch(`/api/seo/response-codes?site_id=${encodeURIComponent(siteId)}`, { method: "GET" });
      if (!res.ok) throw new Error(`Failed to load report: ${res.status}`);
      const data = asEnvelope((await res.json()) as unknown);
      setEnvelope(data);
      setHasFetchError(false);
    } catch (err) {
      console.error("[seo][response-codes] fetch failed", err);
      setEnvelope(empty);
      setHasFetchError(true);
    }
  }, [empty, siteId]);

  const runCrawl = useCallback(async () => {
    setIsRunningCrawl(true);
    setCrawlStartedAt(Date.now());
    setCrawlElapsedSec(0);
    setRunningLineIdx(0);
    setRunStatusMessage(null);
    setRunErrorMessage(null);
    try {
      const result = await runSeoResponseCodesImportFromDashboard(siteId);
      if (!result.ok) {
        setRunErrorMessage(result.error);
        return;
      }
      setRunStatusMessage(result.message || "Crawl started. Results will update shortly.");
    } catch (err) {
      setRunErrorMessage(err instanceof Error ? err.message : "Failed to run crawl.");
    } finally {
      setIsRunningCrawl(false);
      setCrawlStartedAt(null);
      setCrawlElapsedSec(0);
    }
  }, [fetchReport, siteId]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchReport().finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchReport]);

  useEffect(() => {
    if (!isRunningCrawl || !crawlStartedAt) return;
    const timer = setInterval(() => {
      setCrawlElapsedSec(Math.floor((Date.now() - crawlStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunningCrawl, crawlStartedAt]);

  useEffect(() => {
    if (!isRunningCrawl) return;
    const rotation = setInterval(() => {
      setRunningLineIdx((prev) => (prev + 1) % RUNNING_LINES.length);
    }, 2000);
    return () => clearInterval(rotation);
  }, [isRunningCrawl]);

  if (isLoading) {
    return (
      <section className="ui-dash-shell p-6 sm:p-8">
        <div className="rounded-3xl border border-white/20 bg-slate-900/55 p-10 text-center backdrop-blur-xl">
          <p className="text-sm font-semibold text-slate-100">Booting SEO cockpit...</p>
        </div>
      </section>
    );
  }

  const data = envelope ?? empty;
  const current = data.current;
  const comparison = data.comparison;
  const hasData = current.insights.overview.totalUrls > 0;

  const donutData = [
    { name: "200", value: current.raw.summary.healthy },
    { name: "3xx", value: current.raw.summary.redirects },
    { name: "4xx", value: current.raw.summary.clientErrors },
    { name: "5xx", value: current.raw.summary.serverErrors },
    { name: "Unknown", value: current.raw.summary.other },
  ];

  const trendData = [
    { bucket: "200", previous: comparison.deltas.statusBuckets.previous.healthy2xx, current: current.raw.summary.healthy },
    { bucket: "3xx", previous: comparison.deltas.statusBuckets.previous.redirects3xx, current: current.raw.summary.redirects },
    { bucket: "4xx", previous: comparison.deltas.statusBuckets.previous.clientErrors4xx, current: current.raw.summary.clientErrors },
    { bucket: "5xx", previous: comparison.deltas.statusBuckets.previous.serverErrors5xx, current: current.raw.summary.serverErrors },
    { bucket: "Unknown", previous: comparison.deltas.statusBuckets.previous.unknown, current: current.raw.summary.other },
  ];

  const issueBreakdownData = [
    { name: "4xx", count: current.raw.summary.clientErrors },
    { name: "5xx", count: current.raw.summary.serverErrors },
    { name: "3xx", count: current.raw.summary.redirects },
    { name: "Unknown", count: current.raw.summary.other },
  ];

  const changeSplit = [
    { name: "Got worse", value: comparison.regressions.length },
    { name: "Got better", value: comparison.improvements.length },
    { name: "Stable", value: comparison.unchanged.length },
  ];

  const guides = issueGuides(current);
  const baselinePlaybook = [
    getSeoPlaybookResponse("healthy_pages"),
    getSeoPlaybookResponse("improvement"),
    getSeoPlaybookResponse("missing_titles"),
    getSeoPlaybookResponse("missing_meta"),
  ];
  const runStage =
    crawlElapsedSec < 20
      ? "fetching"
      : crawlElapsedSec < 55
        ? "analyzing"
        : "building report";
  const fakeProgress = Math.min(92, 14 + crawlElapsedSec * 1.25);

  return (
    <section id="seo-console" className="space-y-5">
      {isRunningCrawl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-cyan-200/30 bg-linear-to-br from-slate-900/95 via-slate-900/92 to-indigo-950/90 p-5 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-200">Crawl in progress</p>
            <h4 className="mt-2 text-lg font-semibold text-white">Starting the background crawl</h4>
            <p className="mt-2 text-base font-semibold text-cyan-100">{RUNNING_LINES[runningLineIdx]}</p>
            <p className="mt-2 text-sm text-slate-200">
              The crawl runs in the background now. Refresh stats in a bit and the report will update.
            </p>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
              <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 font-semibold uppercase tracking-widest">
                {runStage}
              </span>
              <span className="font-semibold text-cyan-100">Elapsed: {crawlElapsedSec}s</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full animate-pulse bg-linear-to-r from-cyan-400 via-indigo-400 to-fuchsia-400 transition-all duration-700"
                style={{ width: `${fakeProgress}%` }}
              />
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-300">
              <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-cyan-300" />
              <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-indigo-300 [animation-delay:150ms]" />
              <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-fuchsia-300 [animation-delay:300ms]" />
              <span>The crawl worker is checking this site.</span>
            </div>
          </div>
        </div>
      ) : null}
      <div className="space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.45)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">SEO crawl details</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{comparison.overview.headline}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
                {hasData ? comparison.overview.summary : "No crawl data yet. Run SEO Crawl to populate this report."}
              </p>
              {!hasData ? (
                <p className="mt-2 text-xs text-amber-700">
                  If a crawl just finished but this is still empty, refresh stats once the report has saved.
                </p>
              ) : null}
              {comparison.hasPrevious ? (
                <p className="mt-2 text-xs text-slate-500">
                  Comparing latest crawl against the immediately previous crawl for this site.
                </p>
              ) : (
                <p className="mt-2 text-xs text-cyan-700">
                  First crawl baseline captured. Comparison unlocks after your next run.
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => void runCrawl()}
                disabled={isRunningCrawl}
                className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
              >
                {isRunningCrawl ? "Running..." : "Run crawl"}
              </button>
            </div>
          </div>
          {runStatusMessage ? <p className="mt-4 text-xs text-blue-700">{runStatusMessage}</p> : null}
          {runErrorMessage ? <p className="mt-4 text-xs text-amber-700">{runErrorMessage}</p> : null}
          {hasFetchError ? <p className="mt-4 text-xs text-amber-700">Could not load latest report. Showing fallback.</p> : null}
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Pages crawled"
            value={comparison.deltas.totalPages.current}
            previous={comparison.deltas.totalPages.previous}
            delta={comparison.deltas.totalPages.delta}
            trend={comparison.deltas.totalPages.trend}
            help="How many URLs were evaluated in this run."
            infoKey="pages_crawled"
          />
          <MetricCard
            label="Issues found"
            value={comparison.deltas.issuesFound.current}
            previous={comparison.deltas.issuesFound.previous}
            delta={comparison.deltas.issuesFound.delta}
            trend={comparison.deltas.issuesFound.trend}
            help="Lower is better. This tracks pages outside the healthy path."
            infoKey="seo_response_issues"
          />
          <MetricCard
            label="Health score"
            value={comparison.deltas.healthScore.current}
            previous={comparison.deltas.healthScore.previous}
            delta={comparison.deltas.healthScore.delta}
            trend={comparison.deltas.healthScore.trend}
            help="Composite quality signal from response distribution."
            infoKey="seo_response_health_score"
          />
          <article className="relative rounded-2xl border border-white/45 bg-white/90 p-4 pl-10 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.65)] sm:pl-4">
            <div className="absolute right-3 top-3 sm:right-3 sm:top-3.5">
              <InfoTooltip buttonClassName={metricInfoBtn} {...getMetricExplanation("issue_movement")} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Issue movement</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              +{comparison.deltas.newIssues} / -{comparison.deltas.resolvedIssues}
            </p>
            <p className="mt-1 text-xs text-slate-500">New issues vs resolved issues since the previous crawl.</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-linear-to-r from-blue-500 via-violet-500 to-cyan-500"
                style={{ width: `${Math.max(0, Math.min(100, current.insights.overview.healthScore))}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-600">Healthy pages are the backbone. Keep them boring in the best way.</p>
          </article>
        </section>

        <SeoOnPageReportSection
          breakdown={onPageBreakdown}
          priorityRecommendations={current.insights.recommendations as Array<{
            type: string;
            message?: string;
            priority: "high" | "medium" | "low";
          }>}
        />

        <section className="grid gap-5 xl:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.45)]">
            <h3 className="text-base font-semibold text-slate-900">Status code distribution (current)</h3>
            <p className="mt-1 text-xs text-slate-600">Where pages land right now: healthy, redirecting, or breaking.</p>
            <div className="mt-4 h-60">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={2}>
                    {donutData.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.45)]">
            <h3 className="text-base font-semibold text-slate-900">Status code trend (previous vs current)</h3>
            <p className="mt-1 text-xs text-slate-600">Exact bucket movement between the last two crawls.</p>
            <div className="mt-4 h-60">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
                <BarChart data={trendData}>
                  <XAxis dataKey="bucket" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="previous" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="current" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.45)]">
            <h3 className="text-base font-semibold text-slate-900">Issue breakdown</h3>
            <p className="mt-1 text-xs text-slate-600">Count by issue family so you can prioritize effort fast.</p>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
                <BarChart data={issueBreakdownData}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.45)]">
            <h3 className="text-base font-semibold text-slate-900">Regression vs improvement</h3>
            <p className="mt-1 text-xs text-slate-600">What changed quality-wise since your previous crawl.</p>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
                <BarChart data={changeSplit}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {changeSplit.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          entry.name === "Got worse" ? "#f59e0b" : entry.name === "Got better" ? "#3b82f6" : "#8b5cf6"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.45)] sm:p-6">
          <h3 className="text-lg font-semibold text-slate-900">What changed since last crawl</h3>
          <p className="mt-1 text-sm text-slate-600">
            Regressions are things that got worse. Improvements are things that moved in the right direction.
          </p>
          {!comparison.hasPrevious ? (
            <div className="mt-4 space-y-3">
              <p className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
                Comparison unlocks after your next crawl. Baseline is ready.
              </p>
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                While we wait for crawl #2, use the Issue Guide below to tune metadata quality and link hygiene so your next delta looks cleaner.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">⚠ Regressions</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {comparison.regressions.length > 0 ? (
                    comparison.regressions.map((item) => <li key={item.id}>{item.summary}</li>)
                  ) : (
                    <li>No fresh regressions. Nice and calm.</li>
                  )}
                </ul>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">↗ Improvements</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {comparison.improvements.length > 0 ? (
                    comparison.improvements.map((item) => <li key={item.id}>{item.summary}</li>)
                  ) : (
                    <li>No measurable improvements this run.</li>
                  )}
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">Stable</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-800">
                  {comparison.unchanged.length > 0 ? (
                    comparison.unchanged.slice(0, 4).map((line) => <li key={line}>{line}</li>)
                  ) : (
                    <li>No stable signals recorded.</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.45)] sm:p-6">
          <h3 className="text-lg font-semibold text-slate-950">Issue guide (what it means + how to fix)</h3>
          <p className="mt-1 text-sm text-slate-600">Short version: what broke, why it matters, and what “good” looks like.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {guides.map((guide) => (
              <article key={guide.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                  <span>{guide.label}</span>
                  <span className="rounded-full border border-blue-200 bg-white px-2 py-0.5 text-xs text-blue-700">{guide.count}</span>
                </div>
                <div className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-700">
                    {guide.playfulMessage}
                  </p>
                  <p><span className="font-semibold text-slate-950">Why it matters:</span> {guide.why}</p>
                  <div>
                    <p><span className="font-semibold text-slate-950">How to fix:</span></p>
                    <ol className="mt-1 list-decimal space-y-1 pl-4">
                      {guide.fixSteps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/30 bg-white/92 p-5 shadow-[0_24px_60px_-35px_rgba(15,23,42,0.7)] sm:p-6">
          <h3 className="text-lg font-semibold text-slate-900">Action items (prioritized)</h3>
          <p className="mt-1 text-sm text-slate-600">Concrete next steps. No fluff, no duplicated advice.</p>
          <div className="mt-4 space-y-3">
            {comparison.actionItems.length > 0 ? (
              comparison.actionItems.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priorityPill(item.priority)}`}>
                        {item.priority}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {item.affectedCount} affected
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{item.whyItMatters}</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-slate-700">
                    {item.howToFix.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <p className="mt-2 text-xs text-slate-600">
                    <span className="font-semibold">Done when:</span> {item.goodLooksLike}
                  </p>
                </article>
              ))
            ) : (
              <div className="space-y-3">
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  No urgent actions right now. No drama here. These pages are behaving.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {baselinePlaybook.map((item) => (
                    <article key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{item.severity}</p>
                      <h5 className="mt-1 text-sm font-semibold text-slate-900">{item.title}</h5>
                      <p className="mt-1 text-xs text-slate-700">{item.playfulMessage}</p>
                      <p className="mt-2 text-xs text-slate-600">{item.actionableFixSteps[0]}</p>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
