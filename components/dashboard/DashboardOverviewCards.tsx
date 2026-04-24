"use client";

import { getMetricExplanation } from "@/lib/seo/crawl/explanations";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";

const overviewInfoBtn =
  "h-4 w-4 min-h-4 min-w-4 text-[8px] border-white/30 bg-white/10 text-white/90 hover:border-white/50";

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
          className="group relative cursor-pointer rounded-2xl border border-white/20 bg-gradient-to-b from-white/[0.12] to-white/[0.05] p-4 pt-3 pr-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition duration-200 hover:-translate-y-0.5 hover:border-brand/45 hover:shadow-[0_12px_40px_-24px_color-mix(in_srgb,var(--brand)_25%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300/70"
        >
          {card.helpMetricId ? (
            <span
              className="absolute right-2 top-2 z-10"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <InfoTooltip buttonClassName={overviewInfoBtn} {...getMetricExplanation(card.helpMetricId)} />
            </span>
          ) : null}
          <p className="pr-5 text-xs font-semibold uppercase tracking-[0.14em] text-white/68">{card.title}</p>
          <p className="ui-kpi-value mt-2 text-balance text-white">{card.metricPrimary}</p>
          <p className="mt-1 text-sm text-white/75">{card.metricSecondary}</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="line-clamp-2 text-left text-xs text-white/65">{card.status}</span>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${trendClass(card.trend)}`}>
              {trendLabel(card.trend)}
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}
