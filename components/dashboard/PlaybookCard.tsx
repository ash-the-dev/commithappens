import type { AlertPlaybook } from "@/lib/db/alerts";
import { DashboardSection } from "@/components/dashboard/DashboardSection";

type Props = {
  playbooks: AlertPlaybook[];
};

export function PlaybookCard({ playbooks }: Props) {
  return (
    <DashboardSection
      kicker="Playbooks"
      title="If this happens, do this"
      subtitle="No motivational posters — just a checklist when your brain is fried."
    >
      <div className="space-y-3">
        {playbooks.slice(0, 4).map((book) => (
          <article
            key={`${book.category}:${book.title}`}
            className="rounded-2xl border border-slate-200/80 bg-white/70 p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              {book.category.replace(/_/g, " ")} · {book.priority_label}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{book.title}</p>
            <ul className="mt-2 space-y-1">
              {book.steps.map((step) => (
                <li key={step} className="text-sm text-slate-800">
                  - {step}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </DashboardSection>
  );
}

