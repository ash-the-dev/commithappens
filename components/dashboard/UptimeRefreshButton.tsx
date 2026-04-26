"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";
import { getMetricExplanation } from "@/lib/seo/crawl/explanations";

type Props = {
  siteId: string;
  lastCheckedLabel?: string;
  disabled?: boolean;
};

type RefreshResult = {
  ok?: boolean;
  message?: string;
  error?: string;
  statusCode?: number | null;
  responseTimeMs?: number | null;
  retryAfterSec?: number;
};

export function UptimeRefreshButton({ siteId, lastCheckedLabel = "No uptime check yet", disabled = false }: Props) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "error" | null>(null);
  const infoBtn = "h-4 w-4 min-h-4 min-w-4 border-slate-300 bg-slate-100 text-slate-700";

  async function refreshUptime() {
    setIsRefreshing(true);
    setMessage(null);
    setTone(null);

    try {
      const res = await fetch("/api/uptime/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
      });
      const data = (await res.json()) as RefreshResult;

      if (!res.ok || data.ok === false) {
        setTone("error");
        setMessage(data.message || "Uptime refresh did not run. The interval goblin said no.");
        return;
      }

      setTone("success");
      setMessage(
        `Uptime checked: ${data.statusCode ?? "no status"}${data.responseTimeMs != null ? ` in ${data.responseTimeMs}ms` : ""}.`,
      );
      router.refresh();
    } catch {
      setTone("error");
      setMessage("Uptime refresh failed. The probe tripped over a cable.");
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        onClick={() => void refreshUptime()}
        disabled={disabled || isRefreshing}
        className="inline-flex items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRefreshing ? "Checking uptime..." : "Refresh uptime"}
      </button>
      <div className="flex max-w-xs items-center gap-1 text-xs text-slate-500">
        <span>Last uptime check: {lastCheckedLabel}</span>
        <InfoTooltip buttonClassName={infoBtn} {...getMetricExplanation("uptime")} />
      </div>
      {message ? (
        <p className={tone === "success" ? "max-w-xs text-xs text-blue-700" : "max-w-xs text-xs text-amber-700"}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
