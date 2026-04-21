import type { DashboardAnswerResult } from "@/lib/ai/types";

type Props = {
  result: DashboardAnswerResult;
};

export function AnalystAnswerView({ result }: Props) {
  const d = result.data;
  return (
    <div className="mt-4 rounded-xl border border-border/70 bg-black/25 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border/70 bg-black/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">
          {d.source_label === "ai" ? "AI answer" : "Fallback answer"}
        </span>
        <span className="rounded-full border border-border/70 bg-black/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">
          {d.intent}
        </span>
        {d.time_scope ? (
          <span className="rounded-full border border-border/70 bg-black/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">
            {d.time_scope}
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-sm text-white/85">{d.answer}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
            Evidence points
          </p>
          <ul className="mt-2 space-y-1.5">
            {d.evidence_points.map((item) => (
              <li key={item} className="text-sm text-white/75">
                - {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
            Recommended follow-ups
          </p>
          <ul className="mt-2 space-y-1.5">
            {d.recommended_followups.map((item) => (
              <li key={item} className="text-sm text-white/75">
                - {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {d.limitation_note ? (
        <p className="mt-3 text-xs text-amber-200/80">{d.limitation_note}</p>
      ) : null}
      <p className="mt-2 text-xs text-white/55">{d.confidence_note}</p>
    </div>
  );
}

