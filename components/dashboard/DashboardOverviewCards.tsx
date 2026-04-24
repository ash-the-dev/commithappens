"use client";

export type OverviewCard = {
  id: string;
  title: string;
  metricPrimary: string;
  metricSecondary: string;
  status: string;
  trend: "up" | "down" | "stable";
};

type Props = {
  cards: OverviewCard[];
};

function trendLabel(trend: OverviewCard["trend"]): string {
  if (trend === "up") return "up";
  if (trend === "down") return "down";
  return "stable";
}

function trendClass(trend: OverviewCard["trend"]): string {
  if (trend === "up") return "border-emerald-300/40 bg-emerald-300/10 text-emerald-100";
  if (trend === "down") return "border-rose-300/40 bg-rose-300/10 text-rose-100";
  return "border-slate-300/40 bg-slate-300/10 text-slate-100";
}

function openAndScroll(sectionId: string) {
  const panel = document.getElementById(sectionId);
  if (!panel) return;
  const details = panel.closest("details");
  if (details && !details.hasAttribute("open")) {
    details.setAttribute("open", "true");
  }
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function DashboardOverviewCards({ cards }: Props) {
  return (
    <section id="overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => openAndScroll(card.id)}
          className="rounded-2xl border border-white/25 bg-white/10 p-4 text-left transition hover:border-brand/55 hover:bg-white/15"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">{card.title}</p>
          <p className="mt-2 text-xl font-bold text-white">{card.metricPrimary}</p>
          <p className="mt-1 text-sm text-white/75">{card.metricSecondary}</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs text-white/70">{card.status}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${trendClass(card.trend)}`}>
              {trendLabel(card.trend)}
            </span>
          </div>
        </button>
      ))}
    </section>
  );
}
