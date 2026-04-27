"use client";

import { useEffect, useRef, useState } from "react";
import { SpikeExplanationCard } from "@/components/dashboard/SpikeExplanationCard";
import type { SpikeExplanationResult } from "@/lib/ai/types";

type Props = {
  websiteId: string;
  fallback: SpikeExplanationResult | null;
};

type ApiPayload = {
  ok?: boolean;
  explanation?: SpikeExplanationResult | null;
};

export function LazySpikeExplanationCard({ websiteId, fallback }: Props) {
  const [explanation, setExplanation] = useState<SpikeExplanationResult | null>(fallback);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();

    void fetch(`/api/internal/ai/spike-explanation?website_id=${encodeURIComponent(websiteId)}`, {
      method: "GET",
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = (await res.json()) as ApiPayload;
        if (!res.ok || data.ok === false) return fallback;
        return data.explanation ?? fallback;
      })
      .then((nextExplanation) => {
        if (requestIdRef.current === requestId) {
          setExplanation(nextExplanation);
        }
      })
      .catch(() => {
        if (requestIdRef.current === requestId) {
          setExplanation(fallback);
        }
      });

    return () => controller.abort();
  }, [websiteId, fallback]);

  return <SpikeExplanationCard explanation={explanation} />;
}
