import type { DashboardAnswerResult } from "@/lib/ai/types";

type Props = {
  result: DashboardAnswerResult;
};

export function AnalystAnswerView({ result }: Props) {
  const d = result.data;
  return (
    <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-slate-200/90 bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
          {d.source_label === "ai" ? "AI answer" : "Fallback answer"}
        </span>
        <span className="rounded-full border border-slate-200/90 bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
          {d.intent}
        </span>
        {d.time_scope ? (
          <span className="rounded-full border border-slate-200/90 bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
            {d.time_scope}
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-sm text-slate-900">{d.answer}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            Evidence points
          </p>
          <ul className="mt-2 space-y-1.5">
            {d.evidence_points.map((item) => (
              <li key={item} className="text-sm text-slate-800">
                - {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            Recommended follow-ups
          </p>
          <ul className="mt-2 space-y-1.5">
            {d.recommended_followups.map((item) => (
              <li key={item} className="text-sm text-slate-800">
                - {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {d.limitation_note ? (
        <p className="mt-3 text-xs text-amber-900">{d.limitation_note}</p>
      ) : null}
      <p className="mt-2 text-xs text-slate-600">{d.confidence_note}</p>
    </div>
  );
}

