"use client";

import { getMetricExplanation } from "@/lib/seo/crawl/explanations";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";

const overviewInfoBtn =
  "h-4 w-4 min-h-4 min-w-4 text-[8px] border-slate-300 bg-slate-100 text-slate-700 hover:border-blue-300 hover:bg-blue-50";

export type OverviewCard = {
  id: string;
  title: string;
  metricPrimary: string;
  metricSecondary: string;
  status: string;
  trend: "up" | "down" | "stable";
  /** Key for `getMetricExplanation` — small-business friendly blurb. */
  helpMetricId?: string;
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
  if (trend === "up") return "border-blue-200 bg-blue-50 text-blue-700";
  if (trend === "down") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-violet-200 bg-violet-50 text-violet-700";
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

function scrollCardOpen(cardId: string) {
  openAndScroll(cardId);
}

export function DashboardOverviewCards({ cards }: Props) {
  return (
    <section id="overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.id}
          role="button"
          tabIndex={0}
          onClick={() => scrollCardOpen(card.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              scrollCardOpen(card.id);
            }
          }}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 pt-4 pr-3 text-left shadow-[0_18px_50px_-36px_rgba(15,23,42,0.55)] transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_24px_60px_-38px_rgba(59,130,246,0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300/70"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-blue-500 via-violet-500 to-cyan-500" aria-hidden />
          {card.helpMetricId ? (
            <span
              className="absolute right-2 top-2 z-10"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <InfoTooltip buttonClassName={overviewInfoBtn} {...getMetricExplanation(card.helpMetricId)} />
            </span>
          ) : null}
          <p className="pr-5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{card.title}</p>
          <p className="ui-kpi-value mt-2 text-balance text-slate-950">{card.metricPrimary}</p>
          <p className="mt-1 text-sm text-slate-600">{card.metricSecondary}</p>
          <div className="mt-3 flex h-8 items-end gap-1" aria-hidden>
            {[35, 58, 46, 72, 64, 82, 76].map((height, i) => (
              <span
                key={`${card.id}-spark-${i}`}
                className="w-full rounded-t-full bg-linear-to-t from-blue-200 to-cyan-400 opacity-80 transition group-hover:opacity-100"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="line-clamp-2 text-left text-xs text-slate-500">{card.status}</span>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${trendClass(card.trend)}`}>
              {trendLabel(card.trend)}
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}
