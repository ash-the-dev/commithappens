"use client";

import { useEffect, useRef, useState } from "react";
import { AiSummaryCard } from "@/components/dashboard/AiSummaryCard";
import type { WebsiteAiSummaryResult } from "@/lib/ai/types";

type Props = {
  websiteId: string;
};

type ApiPayload = {
  ok?: boolean;
  summary?: WebsiteAiSummaryResult | null;
  error?: string;
};

export function LazyAiSummaryCard({ websiteId }: Props) {
  const [summary, setSummary] = useState<WebsiteAiSummaryResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();

    void fetch(`/api/internal/ai/dashboard-summary?website_id=${encodeURIComponent(websiteId)}`, {
      method: "GET",
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = (await res.json()) as ApiPayload;
        if (!res.ok || data.ok === false) return null;
        return data.summary ?? null;
      })
      .then((nextSummary) => {
        if (requestIdRef.current === requestId) {
          setSummary(nextSummary);
        }
      })
      .catch(() => {
        if (requestIdRef.current === requestId) {
          setSummary(null);
        }
      })
      .finally(() => {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [websiteId]);

  if (summary) {
    return <AiSummaryCard summaryResult={summary} />;
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.55)] sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">AI summary</p>
      <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
        {isLoading ? "Building your plain-English summary..." : "Summary is using saved data for now"}
      </h3>
      <p className="mt-2 text-sm text-slate-700">
        {isLoading
          ? "The dashboard is already usable. This card is just letting the AI layer catch up from stored traffic, uptime, and reputation signals."
          : "AI did not add anything useful before the timeout. No drama, the stored cards still have the receipts."}
      </p>
    </div>
  );
}
