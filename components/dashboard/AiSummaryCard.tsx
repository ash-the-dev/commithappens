import type { WebsiteAiSummaryResult } from "@/lib/ai/types";

type Props = {
  summaryResult: WebsiteAiSummaryResult;
};

function severityClass(severity: "low" | "medium" | "high"): string {
  if (severity === "high") {
    return "border-red-400/45 bg-red-500/10 text-red-100";
  }
  if (severity === "medium") {
    return "border-amber-400/45 bg-amber-500/10 text-amber-100";
  }
  return "border-brand/45 bg-brand/10 text-brand";
}

export function AiSummaryCard({ summaryResult }: Props) {
  const data = summaryResult.data;
  return (
    <section className="ui-surface p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/65">
          Quick read
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityClass(
              data.severity,
            )}`}
          >
            {data.severity}
          </span>
          <span className="ui-chip text-white/70">
            {summaryResult.source === "ai" ? "AI write-up" : "Auto write-up"}
          </span>
        </div>
      </div>

      <p className="mt-4 text-base font-semibold text-white">{data.headline}</p>
      <p className="mt-2 text-sm text-white/80">{data.summary}</p>

      <ul className="mt-4 space-y-2">
        {data.bullets.map((bullet) => (
          <li
            key={bullet}
            className="ui-surface-soft px-3 py-2 text-sm text-white/75"
          >
            {bullet}
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
          What I&apos;d do next
        </p>
        <ul className="mt-2 space-y-1.5">
          {data.recommended_actions.map((action) => (
            <li key={action} className="text-sm text-white/75">
              - {action}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-xs text-white/55">{data.confidence_note}</p>
    </section>
  );
}
