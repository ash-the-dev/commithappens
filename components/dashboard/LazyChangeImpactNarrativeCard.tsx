"use client";

import { useEffect, useRef, useState } from "react";
import { ChangeImpactNarrativeCard } from "@/components/dashboard/ChangeImpactNarrativeCard";
import type { ChangeImpactNarrativeResult } from "@/lib/ai/types";

type Props = {
  changeLogId: string | null;
  fallback: ChangeImpactNarrativeResult | null;
};

type ApiPayload = {
  ok?: boolean;
  narrative?: ChangeImpactNarrativeResult | null;
};

export function LazyChangeImpactNarrativeCard({ changeLogId, fallback }: Props) {
  const [narrative, setNarrative] = useState<ChangeImpactNarrativeResult | null>(fallback);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!changeLogId) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();

    void fetch(`/api/internal/ai/change-narrative?change_log_id=${encodeURIComponent(changeLogId)}`, {
      method: "GET",
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = (await res.json()) as ApiPayload;
        if (!res.ok || data.ok === false) return fallback;
        return data.narrative ?? fallback;
      })
      .then((nextNarrative) => {
        if (requestIdRef.current === requestId) {
          setNarrative(nextNarrative);
        }
      })
      .catch(() => {
        if (requestIdRef.current === requestId) {
          setNarrative(fallback);
        }
      });

    return () => controller.abort();
  }, [changeLogId, fallback]);

  return <ChangeImpactNarrativeCard narrative={narrative} />;
}
