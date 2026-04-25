"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const GENERIC_ERR = "Stats didn’t refresh. Rude. Try again.";
const RUNNING_LINES = [
  "Let the chaos begin...",
  "Crunching numbers and a few feelings...",
  "Almost there. Probably.",
  "Taking a bit longer. That's usually a good sign.",
  "Building your report...",
] as const;

type Props = {
  /** `websites.id` as used in SEO tables (`site_id` text) */
  siteId: string;
  /** `getBillingAccess().seoEnabled` — Committed (and similar) can run the dashboard import. */
  seoEnabled: boolean;
  /** Known environment limitation, shown immediately instead of letting the action feel broken. */
  crawlUnavailableReason?: string | null;
  /** Primary page-level control — larger, higher contrast, meant next to the site title. */
  variant?: "inline" | "hero";
};

/**
 * Report-level control: re-run the dashboard SEO import when allowed, or reload RSC data from DB.
 * Keeps users in the SEO crawl section instead of searching for site-level actions.
 */
export function SeoReportRefreshButton({
  siteId,
  seoEnabled,
  crawlUnavailableReason = null,
  variant = "inline",
}: Props) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStartingCrawl, setIsStartingCrawl] = useState(false);
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [crawlStartedAt, setCrawlStartedAt] = useState<number | null>(null);
  const [crawlElapsedSec, setCrawlElapsedSec] = useState(0);
  const [runningLineIdx, setRunningLineIdx] = useState(0);

  const clearFeedbackLater = useCallback(() => {
    window.setTimeout(() => {
      setFeedback(null);
      setMessage(null);
    }, 15000);
  }, []);

  const onReloadView = useCallback(() => {
    setIsRefreshing(true);
    setFeedback(null);
    setMessage(null);
    try {
      router.refresh();
    } catch {
      setIsRefreshing(false);
      setFeedback("error");
      setMessage(GENERIC_ERR);
      clearFeedbackLater();
      return;
    }
    window.setTimeout(() => {
      setIsRefreshing(false);
      setFeedback("success");
      setMessage("Stats refreshed. Nothing exploded.");
      clearFeedbackLater();
    }, 900);
  }, [clearFeedbackLater, router]);

  const onRunCrawl = useCallback(async () => {
    setIsStartingCrawl(true);
    setFeedback(null);
    setMessage(null);
    setCrawlStartedAt(Date.now());
    setCrawlElapsedSec(0);
    setRunningLineIdx(0);
    try {
      const res = await fetch("/api/seo/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
      });
      const result = (await res.json()) as {
        ok?: boolean;
        status?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok || result.ok === false) {
        setFeedback("error");
        setMessage(result.message || result.error || "Crawl didn’t run. The crawler is playing hard to get.");
        return;
      }
      setFeedback("success");
      setMessage(result.message || "Crawl started. Results will update shortly.");
    } catch {
      setFeedback("error");
      setMessage("Crawl didn’t start. Something’s off.");
    } finally {
      setIsStartingCrawl(false);
      setCrawlStartedAt(null);
      setCrawlElapsedSec(0);
      clearFeedbackLater();
    }
  }, [clearFeedbackLater, siteId]);

  useEffect(() => {
    if (!isStartingCrawl || !crawlStartedAt) return;
    const timer = window.setInterval(() => {
      setCrawlElapsedSec(Math.floor((Date.now() - crawlStartedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [crawlStartedAt, isStartingCrawl]);

  useEffect(() => {
    if (!isStartingCrawl || !crawlStartedAt) return;
    const rotation = window.setInterval(() => {
      setRunningLineIdx((prev) => (prev + 1) % RUNNING_LINES.length);
    }, 2000);
    return () => window.clearInterval(rotation);
  }, [crawlStartedAt, isStartingCrawl]);

  const heroBase =
    "inline-flex min-h-11 w-full min-w-0 max-w-sm items-center justify-center gap-2 rounded-2xl border bg-cyan-300/20 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.1em] text-cyan-50 shadow-[0_12px_40px_-20px_rgba(34,211,238,0.45)] transition hover:bg-cyan-300/32 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:max-w-none";
  const heroBorder = seoEnabled ? "border-cyan-200/70" : "border-white/20 bg-white/10 text-white/90";
  const inlinePrimary =
    "inline-flex min-h-9 shrink-0 items-center justify-center rounded-xl border border-cyan-200/80 bg-cyan-300/35 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-50 transition hover:bg-cyan-300/45 disabled:cursor-not-allowed disabled:opacity-60";
  const inlineReload =
    "inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60";
  const showCrawlOverlay = seoEnabled && isStartingCrawl && crawlStartedAt !== null && !crawlUnavailableReason;
  const runStage =
    crawlElapsedSec < 20 ? "fetching" : crawlElapsedSec < 55 ? "analyzing" : "building report";
  const fakeProgress = Math.min(92, 14 + crawlElapsedSec * 1.25);

  if (!seoEnabled) {
    return (
      <div className="flex w-full min-w-0 max-w-md flex-col items-stretch gap-2 sm:max-w-lg sm:items-end sm:text-right">
        <div className="flex flex-col flex-wrap items-stretch justify-end gap-2 sm:flex-row sm:items-end">
          <button
            type="button"
            onClick={() => onReloadView()}
            disabled={isRefreshing}
            className={variant === "hero" ? `${heroBase} border-white/25 bg-white/12` : inlineReload}
          >
            {isRefreshing ? "Refreshing…" : "Refresh stats"}
          </button>
          <p className="text-[0.7rem] leading-relaxed text-white/55 sm:max-w-sm">
            Reloads performance stats we already have. No crawling. No drama.
          </p>
        </div>
        {feedback && message ? (
          <p
            role="status"
            className={feedback === "success" ? "text-xs text-cyan-100" : "text-xs text-amber-100"}
          >
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col items-stretch gap-1.5 sm:items-end sm:text-right">
      {showCrawlOverlay ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-cyan-200/30 bg-linear-to-br from-slate-900/95 via-slate-900/92 to-indigo-950/90 p-5 text-left shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-200">Crawl is awake</p>
            <h4 className="mt-2 text-lg font-semibold text-white">Sending the bot to go look around</h4>
            <p className="mt-2 text-base font-semibold text-cyan-100">{RUNNING_LINES[runningLineIdx]}</p>
            <p className="mt-2 text-sm text-slate-200">
              This starts the SEO crawl. It does not refresh performance stats. That button has one job now.
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
            <p className="mt-3 text-xs text-slate-300">
              If the crawler chokes, you’ll see it here. No mystery meat.
            </p>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => onReloadView()}
        disabled={isRefreshing || isStartingCrawl}
        className={variant === "hero" ? `${heroBase} ${heroBorder}` : inlinePrimary}
        aria-busy={isRefreshing}
      >
        {isRefreshing ? (
          <>
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-100/30 border-t-cyan-100" />
            <span>Refreshing stats…</span>
          </>
        ) : (
          "Refresh stats"
        )}
      </button>
      {seoEnabled ? (
      <button
          type="button"
          onClick={() => void onRunCrawl()}
        disabled={isRefreshing || isStartingCrawl || Boolean(crawlUnavailableReason)}
          className={variant === "hero" ? `${heroBase} border-violet-200/70 bg-violet-300/18 text-violet-50 hover:bg-violet-300/28` : "inline-flex min-h-9 shrink-0 items-center justify-center rounded-xl border border-violet-200/80 bg-violet-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-violet-900 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-60"}
          aria-busy={isStartingCrawl}
        >
          {isStartingCrawl ? "Starting crawl…" : "Run SEO crawl"}
        </button>
      ) : null}
      {feedback && message ? (
        <p
          role="status"
          className={feedback === "success" ? "text-xs text-cyan-100" : "text-xs text-amber-100"}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
