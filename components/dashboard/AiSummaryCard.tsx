import type { WebsiteAiSummaryResult } from "@/lib/ai/types";
import { DashboardSection } from "@/components/dashboard/DashboardSection";

type Props = {
  summaryResult: WebsiteAiSummaryResult;
};

function severityClass(severity: "low" | "medium" | "high"): string {
  if (severity === "high") {
    return "border-rose-400/45 bg-rose-500/10 text-rose-900";
  }
  if (severity === "medium") {
    return "border-amber-400/45 bg-amber-500/10 text-amber-950";
  }
  return "border-fuchsia-400/35 bg-fuchsia-500/10 text-fuchsia-950";
}

export function AiSummaryCard({ summaryResult }: Props) {
  const data = summaryResult.data;
  return (
    <DashboardSection
      kicker="TL;DR"
      title="Quick read (the honest version)"
      subtitle="A tight story of what changed, what’s risky, and what to do — without the generic SaaS serenity prayer."
      eyebrowRight={
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityClass(
              data.severity,
            )}`}
          >
            {data.severity}
          </span>
          <span className="rounded-full border border-slate-200/90 bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
            {summaryResult.source === "ai" ? "AI write-up" : "Auto write-up"}
          </span>
        </div>
      }
    >
      <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">The takeaway</p>
        <p className="mt-2 text-base font-semibold text-slate-950">{data.headline}</p>
        <p className="mt-2 text-sm text-slate-800">{data.summary}</p>
      </div>

      <ul className="mt-4 space-y-2">
        {data.bullets.map((bullet) => (
          <li
            key={bullet}
            className="rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-2 text-sm text-slate-800"
          >
            {bullet}
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Do this next</p>
        <ul className="mt-2 space-y-1.5">
          {data.recommended_actions.map((action) => (
            <li key={action} className="text-sm text-slate-800">
              - {action}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-xs text-slate-600">{data.confidence_note}</p>
    </DashboardSection>
  );
}
