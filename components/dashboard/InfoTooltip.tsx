"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useState } from "react";
import type { HelpPanelContent } from "@/lib/seo/crawl/explanations";

type Props = HelpPanelContent & {
  className?: string;
  buttonClassName?: string;
  /** Shown as a small chip in the panel. */
  severity?: "critical" | "warning" | "notice" | "healthy" | "info";
  /** e.g. underlying crawl `issue_type` for developers who peek */
  relatedIssueType?: string;
};

const severityPill: Record<NonNullable<Props["severity"]>, string> = {
  critical: "border-rose-300/50 bg-rose-500/20 text-rose-100",
  warning: "border-amber-300/50 bg-amber-500/15 text-amber-100",
  notice: "border-sky-300/50 bg-sky-500/15 text-sky-100",
  healthy: "border-emerald-300/50 bg-emerald-500/15 text-emerald-100",
  info: "border-white/30 bg-white/10 text-white/90",
};

/**
 * Light-touch help: a compact “i” control that opens a readable panel (works on small screens).
 */
export function InfoTooltip({
  term,
  definition,
  whyItMatters,
  improvementTip,
  className = "",
  buttonClassName = "",
  severity,
  relatedIssueType,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelId = useId();
  const label = `What does “${term}” mean?`;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only for portals
    setMounted(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const panel = open && mounted && (
    <div
      className="fixed inset-0 z-[500] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default bg-slate-950/60 backdrop-blur-[2px] transition"
        tabIndex={-1}
        aria-label="Close"
        onClick={close}
      />
      <div
        id={panelId}
        role="dialog"
        aria-label={label}
        aria-modal="true"
        className="relative z-10 w-full max-w-md rounded-t-2xl border border-white/20 bg-slate-950/98 px-4 py-4 text-left text-sm text-slate-100 shadow-2xl sm:rounded-2xl sm:max-h-[min(32rem,85vh)] sm:max-w-lg sm:overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="pr-2 text-base font-semibold text-white">{term}</h3>
          {severity ? (
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${severityPill[severity]}`}>
              {severity}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-slate-200/95">{definition}</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-200/90">
          <span className="font-semibold text-slate-100">Why it matters:</span> {whyItMatters}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
          <span className="font-semibold text-slate-100">What to do next:</span> {improvementTip}
        </p>
        {relatedIssueType ? (
          <p className="mt-3 font-mono text-[11px] text-slate-500">Technical: issue_type = {relatedIssueType}</p>
        ) : null}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={close}
            className="rounded-xl border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <span className={`inline-flex items-center ${className}`}>
      <button
        type="button"
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 leading-none text-white/90 transition hover:border-white/50 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300/80 ${buttonClassName}`}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span className="select-none font-sans text-[12px] font-medium not-italic normal-case">i</span>
      </button>
      {typeof document !== "undefined" && panel ? createPortal(panel, document.body) : null}
    </span>
  );
}
