"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import Link from "next/link";
import { runSeoResponseCodesImportFromDashboard } from "@/lib/seo/response-codes/seo-response-codes-run-client";

const GENERIC_ERR = "Could not refresh report. Please try again.";

type Props = {
  /** `websites.id` as used in SEO tables (`site_id` text) */
  siteId: string;
  /** `getBillingAccess().seoEnabled` — Committed (and similar) can run the dashboard import. */
  seoEnabled: boolean;
};

/**
 * Report-level control: re-run the dashboard SEO import when allowed, or reload RSC data from DB.
 * Keeps users in the SEO crawl section instead of searching for site-level actions.
 */
export function SeoReportRefreshButton({ siteId, seoEnabled }: Props) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const clearFeedbackLater = useCallback(() => {
    window.setTimeout(() => {
      setFeedback(null);
      setMessage(null);
    }, 5000);
  }, []);

  const onReloadView = useCallback(() => {
    setIsPending(true);
    setFeedback(null);
    setMessage(null);
    try {
      router.refresh();
    } catch {
      setIsPending(false);
      setFeedback("error");
      setMessage(GENERIC_ERR);
      clearFeedbackLater();
      return;
    }
    window.setTimeout(() => {
      setIsPending(false);
      setFeedback("success");
      setMessage("Report refreshed");
      clearFeedbackLater();
    }, 900);
  }, [clearFeedbackLater, router]);

  const onRefreshReport = useCallback(async () => {
    setIsPending(true);
    setFeedback(null);
    setMessage(null);
    try {
      const result = await runSeoResponseCodesImportFromDashboard(siteId);
      if (!result.ok) {
        setFeedback("error");
        setMessage(result.error || GENERIC_ERR);
        return;
      }
      router.refresh();
      setFeedback("success");
      setMessage("Report refreshed");
    } catch {
      setFeedback("error");
      setMessage(GENERIC_ERR);
    } finally {
      setIsPending(false);
      clearFeedbackLater();
    }
  }, [clearFeedbackLater, router, siteId]);

  if (!seoEnabled) {
    return (
      <div className="flex min-w-0 max-w-md flex-col items-stretch gap-2 sm:items-end sm:text-right">
        <div className="flex flex-wrap items-end justify-end gap-2">
          <button
            type="button"
            onClick={() => onReloadView()}
            disabled={isPending}
            className="inline-flex min-h-9 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Refreshing..." : "Reload snapshot"}
          </button>
          <p className="text-[0.7rem] leading-relaxed text-white/55 sm:max-w-56">
            Dashboard re-import requires{" "}
            <Link className="font-semibold text-cyan-200/90 underline decoration-cyan-200/50 hover:text-cyan-100" href="/pricing">
              Committed
            </Link>
            . After a local import, reload picks up the latest data.
          </p>
        </div>
        {feedback && message ? (
          <p
            role="status"
            className={feedback === "success" ? "text-xs text-emerald-200" : "text-xs text-rose-200"}
          >
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col items-end gap-1 text-right">
      <button
        type="button"
        onClick={() => void onRefreshReport()}
        disabled={isPending}
        className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-xl border border-cyan-200/45 bg-cyan-400/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-50 transition hover:bg-cyan-400/25 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Refreshing..." : "Refresh Report"}
      </button>
      {feedback && message ? (
        <p
          role="status"
          className={feedback === "success" ? "text-xs text-emerald-200" : "text-xs text-rose-200"}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
