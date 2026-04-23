import type { WebsiteRecommendationsResult } from "@/lib/ai/types";
import { DashboardSection } from "@/components/dashboard/DashboardSection";

type Props = {
  recommendations: WebsiteRecommendationsResult;
};

function priorityClass(priority: "critical" | "high" | "medium" | "low"): string {
  if (priority === "critical") return "border-rose-500/50 bg-rose-600/15 text-rose-950";
  if (priority === "high") return "border-rose-400/45 bg-rose-500/10 text-rose-900";
  if (priority === "medium") return "border-amber-400/45 bg-amber-500/10 text-amber-950";
  return "border-fuchsia-400/35 bg-fuchsia-500/10 text-fuchsia-950";
}

export function RecommendationsCard({ recommendations }: Props) {
  const d = recommendations.data;
  return (
    <DashboardSection
      kicker="Action queue"
      title="Your next move"
      subtitle="A prioritized punch list: what’s on fire, what’s next, and what’s a sneaky easy win."
      eyebrowRight={
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityClass(
              d.priority_label,
            )}`}
          >
            {d.priority_label}
          </span>
          <span className="rounded-full border border-slate-200/90 bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
            {recommendations.source === "ai"
              ? "AI suggestions"
              : "Auto suggestions"}
          </span>
        </div>
      }
    >
      <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">The takeaway</p>
        <p className="mt-2 text-base font-semibold text-slate-950">{d.headline}</p>
        <p className="mt-2 text-sm text-slate-800">{d.summary}</p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            Do this now
          </p>
          {d.urgent_actions.length === 0 ? (
            <p className="mt-2 text-sm text-slate-700">Nothing on fire. Don’t invent drama.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {d.urgent_actions.map((item) => (
                <li key={item} className="text-sm text-slate-800">
                  - {item}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            Then do this
          </p>
          <ul className="mt-2 space-y-1.5">
            {d.next_actions.map((item) => (
              <li key={item} className="text-sm text-slate-800">
                - {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            Easy wins
          </p>
          {d.opportunities.length === 0 ? (
            <p className="mt-2 text-sm text-slate-700">
              No obvious easy wins beyond what&apos;s already listed.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {d.opportunities.map((item) => (
                <li key={item} className="text-sm text-slate-800">
                  - {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-600">{d.confidence_note}</p>
    </DashboardSection>
  );
}
