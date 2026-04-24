"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  idleLabel?: string;
  loadingLabel?: string;
};

export function RefreshPageDataButton({
  idleLabel = "Refresh stats",
  loadingLabel = "Refreshing...",
}: Props) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        setIsRefreshing(true);
        router.refresh();
        setTimeout(() => {
          setIsRefreshing(false);
        }, 900);
      }}
      disabled={isRefreshing}
      className="inline-flex items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isRefreshing ? loadingLabel : idleLabel}
    </button>
  );
}
