"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";
import { getMetricExplanation } from "@/lib/seo/crawl/explanations";

type Props = {
  idleLabel?: string;
  loadingLabel?: string;
  lastLoadedLabel?: string;
};

export function RefreshPageDataButton({
  idleLabel = "Refresh analytics",
  loadingLabel = "Refreshing analytics...",
  lastLoadedLabel = "Loaded just now",
}: Props) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const infoBtn = "h-4 w-4 min-h-4 min-w-4 border-slate-300 bg-slate-100 text-slate-700";

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        onClick={() => {
          setIsRefreshing(true);
          setMessage(null);
          router.refresh();
          setTimeout(() => {
            setIsRefreshing(false);
            setLastRefreshedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
            setMessage("Analytics refreshed from stored events. If the tracker has new receipts, they’re here.");
          }, 900);
        }}
        disabled={isRefreshing}
        className="inline-flex items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRefreshing ? loadingLabel : idleLabel}
      </button>
      <div className="flex max-w-xs items-center gap-1 text-xs text-slate-500">
        <span>{lastRefreshedAt ? `Analytics view refreshed at ${lastRefreshedAt}` : lastLoadedLabel}</span>
        <InfoTooltip buttonClassName={infoBtn} {...getMetricExplanation("traffic_overview")} />
      </div>
      {message ? <p className="max-w-xs text-xs text-slate-600">{message}</p> : null}
    </div>
  );
}
