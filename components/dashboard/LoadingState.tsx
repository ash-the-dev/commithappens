"use client";

import { useEffect, useState } from "react";

const DASHBOARD_LOADING_LINES = [
  "Let the chaos begin...",
  "Crunching numbers and a few feelings...",
  "Almost there. Probably.",
  "Taking a bit longer. That's usually a good sign.",
  "Building your report...",
] as const;

export function LoadingState() {
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setLineIndex((prev) => (prev + 1) % DASHBOARD_LOADING_LINES.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="rounded-3xl border border-white/20 bg-white/10 px-6 py-10 text-center backdrop-blur-md">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">Loading dashboard</p>
      <p className="mt-3 text-lg font-semibold text-white">{DASHBOARD_LOADING_LINES[lineIndex]}</p>
    </div>
  );
}
