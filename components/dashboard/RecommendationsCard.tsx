import type { WebsiteRecommendationsResult } from "@/lib/ai/types";

type Props = {
  recommendations: WebsiteRecommendationsResult;
};

function priorityClass(priority: "critical" | "high" | "medium" | "low"): string {
  if (priority === "critical") return "border-red-500/50 bg-red-600/15 text-red-100";
  if (priority === "high") return "border-red-400/40 bg-red-500/10 text-red-100";
  if (priority === "medium") return "border-amber-400/45 bg-amber-500/10 text-amber-100";
  return "border-brand/45 bg-brand/10 text-brand";
}

export function RecommendationsCard({ recommendations }: Props) {
  const d = recommendations.data;
  return (
    <section className="ui-surface p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/65">
          What I&apos;d do next
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityClass(
              d.priority_label,
            )}`}
          >
            {d.priority_label}
          </span>
          <span className="ui-chip text-white/70">
            {recommendations.source === "ai"
              ? "AI suggestions"
              : "Auto suggestions"}
          </span>
        </div>
      </div>

      <p className="mt-4 text-base font-semibold text-white">{d.headline}</p>
      <p className="mt-2 text-sm text-white/80">{d.summary}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="ui-surface-soft p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
            Do this now
          </p>
          {d.urgent_actions.length === 0 ? (
            <p className="mt-2 text-sm text-white/60">Nothing on fire right now.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {d.urgent_actions.map((item) => (
                <li key={item} className="text-sm text-white/75">
                  - {item}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="ui-surface-soft p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
            Then do this
          </p>
          <ul className="mt-2 space-y-1.5">
            {d.next_actions.map((item) => (
              <li key={item} className="text-sm text-white/75">
                - {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="ui-surface-soft p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
            Easy wins
          </p>
          {d.opportunities.length === 0 ? (
            <p className="mt-2 text-sm text-white/60">
              No obvious easy wins beyond what&apos;s already listed.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {d.opportunities.map((item) => (
                <li key={item} className="text-sm text-white/75">
                  - {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-white/55">{d.confidence_note}</p>
    </section>
  );
}
