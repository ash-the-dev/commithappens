import type { WebsiteAlert } from "@/lib/db/alerts";
import { DashboardSection } from "@/components/dashboard/DashboardSection";

type Props = {
  alerts: WebsiteAlert[];
};

function severityClass(severity: "critical" | "high" | "medium" | "low"): string {
  if (severity === "critical") return "border-rose-500/55 bg-rose-600/15 text-rose-950";
  if (severity === "high") return "border-rose-400/45 bg-rose-500/10 text-rose-900";
  if (severity === "medium") return "border-amber-400/45 bg-amber-500/10 text-amber-950";
  return "border-fuchsia-400/35 bg-fuchsia-500/10 text-fuchsia-950";
}

export function AlertCenterCard({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <DashboardSection
        emphasis="green"
        kicker="Alerts"
        title="Pay attention to this"
        subtitle="When something is actually wrong, we’ll be annoyingly clear about it."
      >
        <p className="text-sm text-slate-700">Nothing weird going on right now. Suspiciously peaceful.</p>
      </DashboardSection>
    );
  }

  return (
    <DashboardSection
      kicker="Alerts"
      title="Pay attention to this"
      subtitle="Not ‘everything is an incident.’ Just the stuff that can bite you if you ignore it."
    >
      <div className="space-y-3">
        {alerts.slice(0, 5).map((alert) => (
          <article
            key={alert.id}
            className="rounded-2xl border border-slate-200/80 bg-white/70 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityClass(
                  alert.severity,
                )}`}
              >
                {alert.severity}
              </span>
              <span className="rounded-full border border-slate-200/90 bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                {alert.category.replace(/_/g, " ")}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-950">{alert.title}</p>
            <p className="mt-1 text-sm text-slate-800">{alert.summary}</p>
            <ul className="mt-2 space-y-1">
              {alert.evidence_points.slice(0, 2).map((e) => (
                <li key={e} className="text-xs text-slate-600">
                  - {e}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </DashboardSection>
  );
}

