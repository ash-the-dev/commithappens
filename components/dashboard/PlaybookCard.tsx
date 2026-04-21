import type { AlertPlaybook } from "@/lib/db/alerts";

type Props = {
  playbooks: AlertPlaybook[];
};

export function PlaybookCard({ playbooks }: Props) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-white/65">
        If this happens, do this
      </h2>
      <div className="mt-4 space-y-3">
        {playbooks.slice(0, 4).map((book) => (
          <article
            key={`${book.category}:${book.title}`}
            className="rounded-xl border border-border/70 bg-black/25 p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
              {book.category.replace(/_/g, " ")} · {book.priority_label}
            </p>
            <p className="mt-1 text-sm font-semibold text-white">{book.title}</p>
            <ul className="mt-2 space-y-1">
              {book.steps.map((step) => (
                <li key={step} className="text-sm text-white/75">
                  - {step}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

