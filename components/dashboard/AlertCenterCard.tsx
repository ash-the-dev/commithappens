import type { WebsiteAlert } from "@/lib/db/alerts";

type Props = {
  alerts: WebsiteAlert[];
};

function severityClass(severity: "critical" | "high" | "medium" | "low"): string {
  if (severity === "critical") return "border-red-500/55 bg-red-600/15 text-red-100";
  if (severity === "high") return "border-red-400/40 bg-red-500/10 text-red-100";
  if (severity === "medium") return "border-amber-400/40 bg-amber-500/10 text-amber-100";
  return "border-brand/40 bg-brand/10 text-brand";
}

export function AlertCenterCard({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/65">
          Pay attention to this
        </h2>
        <p className="mt-4 text-sm text-white/55">Nothing weird going on right now.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-white/65">Pay attention to this</h2>
      <div className="mt-4 space-y-3">
        {alerts.slice(0, 5).map((alert) => (
          <article
            key={alert.id}
            className="rounded-xl border border-border/70 bg-black/25 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityClass(
                  alert.severity,
                )}`}
              >
                {alert.severity}
              </span>
              <span className="rounded-full border border-border/70 bg-black/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                {alert.category.replace(/_/g, " ")}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-white">{alert.title}</p>
            <p className="mt-1 text-sm text-white/75">{alert.summary}</p>
            <ul className="mt-2 space-y-1">
              {alert.evidence_points.slice(0, 2).map((e) => (
                <li key={e} className="text-xs text-white/60">
                  - {e}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

