import type { ChangeImpactNarrativeResult } from "@/lib/ai/types";
import { DashboardSection } from "@/components/dashboard/DashboardSection";

type Props = {
  narrative: ChangeImpactNarrativeResult | null;
};

function severityClass(severity: "low" | "medium" | "high"): string {
  if (severity === "high") return "border-rose-400/45 bg-rose-500/10 text-rose-900";
  if (severity === "medium") return "border-amber-400/45 bg-amber-500/10 text-amber-950";
  return "border-fuchsia-400/35 bg-fuchsia-500/10 text-fuchsia-950";
}

export function ChangeImpactNarrativeCard({ narrative }: Props) {
  if (!narrative) {
    return (
      <DashboardSection
        kicker="Ship log"
        title="Did your deploy matter?"
        subtitle="If you don’t log changes, the dashboard can’t roast you constructively. Tough love."
      >
        <p className="text-sm text-slate-700">No recent changes logged, so nothing to compare yet.</p>
      </DashboardSection>
    );
  }

  const d = narrative.data;
  return (
    <DashboardSection
      kicker="Ship log"
      title="Did your deploy matter?"
      subtitle="Code that commits. Unlike your ex. Let’s see if the internet noticed."
      eyebrowRight={
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityClass(
              d.severity,
            )}`}
          >
            {d.severity}
          </span>
          <span className="rounded-full border border-slate-200/90 bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
            {narrative.source === "ai" ? "AI read" : "Auto read"}
          </span>
        </div>
      }
    >
      <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">The takeaway</p>
        <p className="mt-2 text-base font-semibold text-slate-950">{d.headline}</p>
        <p className="mt-2 text-sm text-slate-800">{d.summary}</p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">What changed</p>
          <ul className="mt-2 space-y-1.5">
            {d.notable_changes.map((item) => (
              <li key={item} className="text-sm text-slate-800">
                - {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Your next move</p>
          <ul className="mt-2 space-y-1.5">
            {d.recommended_checks.map((check) => (
              <li key={check} className="text-sm text-slate-800">
                - {check}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-600">{d.confidence_note}</p>
    </DashboardSection>
  );
}
