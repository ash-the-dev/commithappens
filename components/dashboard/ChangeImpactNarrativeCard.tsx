import type { ChangeImpactNarrativeResult } from "@/lib/ai/types";

type Props = {
  narrative: ChangeImpactNarrativeResult | null;
};

function severityClass(severity: "low" | "medium" | "high"): string {
  if (severity === "high") return "border-red-400/45 bg-red-500/10 text-red-100";
  if (severity === "medium") return "border-amber-400/45 bg-amber-500/10 text-amber-100";
  return "border-brand/45 bg-brand/10 text-brand";
}

export function ChangeImpactNarrativeCard({ narrative }: Props) {
  if (!narrative) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/65">
          Did your deploy matter?
        </h2>
        <p className="mt-4 text-sm text-white/55">No recent changes logged, so nothing to compare yet.</p>
      </section>
    );
  }

  const d = narrative.data;
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/65">
          Did your deploy matter?
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityClass(
              d.severity,
            )}`}
          >
            {d.severity}
          </span>
          <span className="rounded-full border border-border/70 bg-black/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">
            {narrative.source === "ai" ? "AI read" : "Auto read"}
          </span>
        </div>
      </div>

      <p className="mt-4 text-base font-semibold text-white">{d.headline}</p>
      <p className="mt-2 text-sm text-white/80">{d.summary}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
            What changed
          </p>
          <ul className="mt-2 space-y-1.5">
            {d.notable_changes.map((item) => (
              <li key={item} className="text-sm text-white/75">
                - {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
            Check this next
          </p>
          <ul className="mt-2 space-y-1.5">
            {d.recommended_checks.map((check) => (
              <li key={check} className="text-sm text-white/75">
                - {check}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-4 text-xs text-white/55">{d.confidence_note}</p>
    </section>
  );
}
