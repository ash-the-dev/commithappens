"use client";

import { Children, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import type { SiteLiveActivityItem, SiteTopPage } from "@/lib/db/analytics";
import type { SiteTrendsPayload } from "@/lib/dashboard/site-trends";

export type CommandCenterBriefingCard = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  statusLabel: string;
  statusTone: "good" | "warn" | "bad" | "neutral";
  meta: string[];
  cta: string;
  targetTab?: string;
  accent: "cyan" | "blue" | "violet" | "amber" | "pink" | "slate";
};

export type CommandCenterTab = {
  id: string;
  label: string;
};

type IssueBreakdownItem = {
  name: string;
  value: number;
};

type Props = {
  briefingCards: CommandCenterBriefingCard[];
  trends: SiteTrendsPayload;
  topPages: SiteTopPage[];
  issueBreakdown: IssueBreakdownItem[];
  attentionItems: string[];
  activityItems: SiteLiveActivityItem[];
  tabs: CommandCenterTab[];
  children: ReactNode;
};

const cardAccent: Record<CommandCenterBriefingCard["accent"], string> = {
  cyan: "from-cyan-400 to-blue-500",
  blue: "from-blue-500 to-indigo-500",
  violet: "from-violet-500 to-fuchsia-500",
  amber: "from-amber-400 to-orange-400",
  pink: "from-fuchsia-400 to-pink-500",
  slate: "from-slate-400 to-slate-600",
};

const statusToneClass: Record<CommandCenterBriefingCard["statusTone"], string> = {
  good: "border-emerald-300/60 bg-emerald-400/15 text-emerald-50",
  warn: "border-amber-300/60 bg-amber-400/15 text-amber-50",
  bad: "border-rose-300/60 bg-rose-400/15 text-rose-50",
  neutral: "border-white/20 bg-white/10 text-white/80",
};

const donutColors = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#64748b"];

function barPercent(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(3, Math.round((value / max) * 100));
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function pageLabel(path: string | null | undefined): string {
  if (!path || path === "/") return "Homepage";
  return path;
}

function compactPageLabel(path: string | null | undefined): string {
  const label = pageLabel(path);
  return label.length > 22 ? `${label.slice(0, 10)}...${label.slice(-8)}` : label;
}

function issueNameLower(name: string): string {
  return name.toLowerCase().replaceAll("_", " ");
}

function HealthTrendCard({ trends }: { trends: SiteTrendsPayload }) {
  const chartData = trends.seoHealth.map((point, index) => ({
    label: point.label,
    score: point.score,
    issues: trends.issues[index]?.count ?? 0,
  }));
  const hasData = chartData.length > 0;
  const maxIssues = Math.max(1, ...chartData.map((point) => point.issues));
  const latest = chartData.at(-1);
  const previous = chartData.at(-2);
  const healthDelta = latest && previous ? latest.score - previous.score : 0;
  const trendSymbol = !latest || !previous ? "→" : healthDelta > 0 ? "↑" : healthDelta < 0 ? "↓" : "→";
  const trendLabel = !latest || !previous ? "baseline" : healthDelta > 0 ? "improving" : healthDelta < 0 ? "declining" : "stable";
  const issueDriver = latest && latest.issues > 0 ? "small structure issues are stacking up quietly" : "the crawl is staying clean";
  const interpretation =
    latest && previous
      ? healthDelta > 0
        ? `Health improved by ${healthDelta} point${healthDelta === 1 ? "" : "s"}. ${issueDriver}.`
        : healthDelta < 0
          ? `Health dipped by ${Math.abs(healthDelta)} point${Math.abs(healthDelta) === 1 ? "" : "s"}. ${issueDriver}.`
          : `Health is stable overall, but ${issueDriver}.`
      : "This is the baseline. Run another crawl to see whether the site is improving or quietly getting weird.";

  return (
    <article className="ui-fade-in rounded-3xl border border-slate-200/70 bg-(--card-solid-bg) p-5 shadow-[0_22px_60px_-46px_rgba(15,23,42,0.5)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">SEO command chart</p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">Health and issues</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Stored crawl trend. Empty until SEO Crawl has real history.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {trendSymbol} {trendLabel}
        </span>
      </div>
      <div className="ui-chart-shell mt-4 min-h-40 p-3">
        {hasData ? (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-2">
              {chartData.map((point, index) => (
                <div key={`${point.label}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <div className="flex h-20 w-full max-w-8 items-end justify-center rounded-full bg-slate-100/60 px-1">
                    <span
                      className={`w-full rounded-full bg-linear-to-t from-blue-500 to-cyan-300 ${
                        index === chartData.length - 1 ? "ring-2 ring-blue-300 ring-offset-2" : "opacity-45"
                      }`}
                      style={{ height: `${Math.max(5, point.score)}%` }}
                      title={`${point.label}: ${point.score} health, ${point.issues} issues`}
                    />
                  </div>
                  <span className="max-w-14 truncate text-[10px] font-medium text-slate-500">{point.label}</span>
                </div>
              ))}
            </div>
            <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
              <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 leading-relaxed">
                Latest health: <span className="font-semibold text-slate-950">{latest?.score ?? 0}/100</span>
                <span className="mt-1 block text-[11px] text-slate-600">{interpretation}</span>
              </p>
              <p className="rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 leading-relaxed">
                Latest issues: <span className="font-semibold text-slate-950">{latest?.issues ?? 0}</span>
                <span className="mt-1 block text-[11px] text-slate-600">
                  What to do next: fix structure issues before spending time on polish.
                </span>
              </p>
            </div>
            <div className="space-y-1.5">
              {chartData.slice(-3).map((point, index) => (
                <div key={`${point.label}-${index}-issues`} className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="w-14 truncate">{point.label}</span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100/70">
                    <div className="h-full rounded-full bg-violet-400/70" style={{ width: `${barPercent(point.issues, maxIssues)}%` }} />
                  </div>
                  <span className="w-8 text-right tabular-nums">{point.issues}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-500">
            Run SEO Crawl twice and we’ll show whether things are improving, slipping, or staying weird.
          </div>
        )}
      </div>
    </article>
  );
}

function AttentionCard({ items }: { items: string[] }) {
  const fixNow = items.slice(0, 3);
  const quickWins = items.slice(3, 6);
  const canWait = items.slice(6, 9);
  const groups = [
    { title: "🔥 Fix now", items: fixNow, className: "border-rose-200 bg-rose-50/80 text-rose-950" },
    { title: "⚡ Quick wins", items: quickWins, className: "border-amber-200 bg-amber-50/80 text-amber-950" },
    { title: "💤 Can wait", items: canWait, className: "border-slate-200 bg-slate-50 text-slate-700" },
  ].filter((group) => group.items.length > 0);

  return (
    <article className="ui-fade-in rounded-3xl border border-slate-200/70 bg-(--card-solid-bg) p-5 shadow-[0_22px_60px_-46px_rgba(15,23,42,0.5)]">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-600">Needs attention</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">What to look at now</h2>
      <p className="mt-1 text-sm font-medium text-slate-700">
        These are the fastest ways to stop quietly losing search traffic.
      </p>
      <div className="mt-4 space-y-3">
        {items.length > 0 ? (
          groups.map((group) => (
            <div key={group.title} className={`rounded-2xl border p-3 ${group.className}`}>
              <p className="text-xs font-black uppercase tracking-[0.14em]">{group.title}</p>
              <ul className="mt-2 space-y-2">
                {group.items.map((item, index) => (
                  <li key={`${group.title}-${item}-${index}`} className="text-sm leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-slate-700">
            Nothing yelling yet. Run a crawl and we’ll find something useful to complain about.
          </div>
        )}
      </div>
    </article>
  );
}

function TopPagesCard({ topPages }: { topPages: SiteTopPage[] }) {
  const data = useMemo(
    () =>
      topPages.slice(0, 6).map((page, index) => ({
        label: compactPageLabel(page.path),
        path: pageLabel(page.path),
        views: page.views,
        rank: `#${index + 1}`,
      })),
    [topPages],
  );
  const maxViews = Math.max(1, ...data.map((page) => page.views));

  return (
    <article className="ui-fade-in rounded-3xl border border-slate-200/70 bg-(--card-solid-bg) p-5 shadow-[0_22px_60px_-46px_rgba(15,23,42,0.5)]">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Top pages</p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">Where attention is landing</h2>
      <p className="mt-1 text-sm text-slate-600">Real pageviews from the tracker. “Homepage” means the domain root.</p>
      <div className="ui-chart-shell mt-4 min-h-56 p-3">
        {data.length > 0 ? (
          <div className="space-y-3">
            {data.map((page) => (
              <div key={`${page.rank}-${page.path}`} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate font-semibold text-slate-700">
                    {page.rank} {page.path}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-500">{page.views.toLocaleString("en-US")}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand/75" style={{ width: `${barPercent(page.views, maxViews)}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">
            No pageviews yet. Either it’s quiet, or the tracker’s on vacation.
          </div>
        )}
      </div>
    </article>
  );
}

function IssueBreakdownCard({ issues }: { issues: IssueBreakdownItem[] }) {
  const total = issues.reduce((sum, item) => sum + item.value, 0);
  const data = issues.filter((item) => item.value > 0);
  const maxIssueValue = Math.max(1, ...data.map((item) => item.value));
  const topIssue = [...data].sort((a, b) => b.value - a.value)[0] ?? null;
  const topIssueName = topIssue ? issueNameLower(topIssue.name) : "structure";
  const interpretation = topIssue
    ? `${topIssue.value} page${topIssue.value === 1 ? "" : "s"} are underperforming due to missing structure (mostly ${topIssueName}).`
    : "No issue family is leading the pack right now.";

  return (
    <article className="ui-fade-in rounded-3xl border border-slate-200/70 bg-(--card-solid-bg) p-5 shadow-[0_22px_60px_-46px_rgba(15,23,42,0.5)]">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-600">Issue mix</p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">Crawl issue breakdown</h2>
      <p className="mt-1 text-sm font-medium text-slate-800">{interpretation}</p>
      <p className="mt-1 text-xs text-slate-600">
        This won’t break your site, but it weakens how search engines understand your pages.
      </p>
      <div className="mt-4 min-h-40">
        {total > 0 ? (
          <div className="space-y-3">
            <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
              {data.map((item, index) => (
                <span
                  key={item.name}
                  style={{
                    width: `${Math.max(4, Math.round((item.value / total) * 100))}%`,
                    background: donutColors[index % donutColors.length],
                  }}
                  title={`${item.name}: ${item.value}`}
                />
              ))}
            </div>
            <div className="space-y-2">
              {data.map((item, index) => (
                <div key={`${item.name}-bar`} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-2 font-medium text-slate-700">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: donutColors[index % donutColors.length] }} />
                      {item.name}
                    </span>
                    <span className="font-semibold tabular-nums text-slate-950">{item.value}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${barPercent(item.value, maxIssueValue)}%`, background: donutColors[index % donutColors.length] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">
            No major issue families found yet.
          </div>
        )}
      </div>
      <div className="mt-2 grid gap-2 text-xs text-slate-600">
        {total > 0 ? (
          data.map((item, index) => (
            <div key={item.name} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: donutColors[index % donutColors.length] }} />
                {item.name}
              </span>
              <span className="font-semibold text-slate-900">{item.value}</span>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
            Nothing worth charting yet.
          </p>
        )}
      </div>
    </article>
  );
}

function CompactActivityCard({ items }: { items: SiteLiveActivityItem[] }) {
  const dedupedItems = useMemo(() => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const minute = item.occurredAt.slice(0, 16);
      const key = `${item.type}:${item.label}:${item.path ?? ""}:${minute}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [items]);

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.55)]">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-600">Recent activity</p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">Latest tracked events</h2>
      <p className="mt-1 text-sm text-slate-600">Deduped recent tracker events. These are status rows, not mystery buttons.</p>
      <div className="mt-4 space-y-2">
        {dedupedItems.length > 0 ? (
          dedupedItems.slice(0, 5).map((item) => (
            <div key={`${item.type}-${item.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">{item.label}</p>
                  <p className="mt-1 truncate font-mono text-xs text-slate-500">{pageLabel(item.path) || item.type}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-slate-500">{timeAgo(item.occurredAt)}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No recent activity. Suspiciously quiet.
          </p>
        )}
      </div>
    </article>
  );
}

export function SiteCommandCenterDashboard({
  briefingCards,
  trends,
  topPages,
  issueBreakdown,
  attentionItems,
  activityItems,
  tabs,
  children,
}: Props) {
  const panels = Children.toArray(children);
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === activeTab));
  const tabIds = useMemo(() => new Set(tabs.map((tab) => tab.id)), [tabs]);

  const activateTab = useCallback(
    (tabId: string, syncHash = false) => {
      if (!tabIds.has(tabId)) return;
      setActiveTab(tabId);
      if (syncHash && typeof window !== "undefined") {
        window.history.replaceState(null, "", `#${tabId}`);
      }
    },
    [tabIds],
  );

  const handleBriefingCardClick = useCallback(
    (target: string | undefined) => {
      if (!target) return;
      if (tabIds.has(target)) {
        activateTab(target, true);
        window.setTimeout(() => {
          document.getElementById("details")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);
        return;
      }
      const el = document.getElementById(target);
      if (el) {
        window.history.replaceState(null, "", `#${target}`);
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [activateTab, tabIds],
  );

  useEffect(() => {
    const activateFromHash = () => {
      const tabId = window.location.hash.replace(/^#/, "");
      if (tabId) activateTab(tabId);
    };
    activateFromHash();
    window.addEventListener("hashchange", activateFromHash);
    return () => window.removeEventListener("hashchange", activateFromHash);
  }, [activateTab]);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {briefingCards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => handleBriefingCardClick(card.targetTab)}
            className="group flex min-h-72 flex-col rounded-3xl border border-white/12 bg-slate-950/72 p-4 text-left shadow-[0_22px_75px_-40px_rgba(0,0,0,0.9)] backdrop-blur transition hover:-translate-y-0.5 hover:border-cyan-200/45 hover:bg-slate-950/82 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 sm:p-5"
          >
            <div className={`h-1.5 rounded-full bg-linear-to-r ${cardAccent[card.accent]}`} aria-hidden />
            <div className="mt-4 flex items-start justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100/70">{card.eyebrow}</p>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusToneClass[card.statusTone]}`}>
                {card.statusLabel}
              </span>
            </div>
            <h2 className="mt-3 text-xl font-black tracking-tight text-white">{card.title}</h2>
            <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-200/82">{card.description}</p>
            <div className="mt-4 space-y-1.5">
              {card.meta.map((item) => (
                <p key={item} className="text-xs font-medium text-slate-300/80">
                  {item}
                </p>
              ))}
            </div>
            <span className="mt-auto inline-flex pt-5 text-sm font-bold text-cyan-100 transition group-hover:text-white">
              {card.cta}
            </span>
          </button>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <TopPagesCard topPages={topPages} />
        <CompactActivityCard items={activityItems} />
      </section>

      <section id="details" className="rounded-3xl border border-slate-200/80 bg-white/95 p-2 shadow-[0_24px_90px_-52px_rgba(15,23,42,0.68)] backdrop-blur">
        <div className="flex gap-2 overflow-x-auto p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => activateTab(tab.id, true)}
              className={`shrink-0 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "border-cyan-200 bg-cyan-50 text-slate-950 shadow-sm"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white hover:text-slate-950"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="rounded-[1.35rem] bg-white p-4 shadow-[0_20px_70px_-45px_rgba(15,23,42,0.7)] sm:p-5">
          {activeTab === "seo-crawl" ? (
            <div className="space-y-5">
              <section className="grid gap-5 lg:grid-cols-3">
                <HealthTrendCard trends={trends} />
                <IssueBreakdownCard issues={issueBreakdown} />
              </section>
              <AttentionCard items={attentionItems} />
              {panels[activeIndex] ?? null}
            </div>
          ) : (
            panels[activeIndex] ?? null
          )}
        </div>
      </section>
    </div>
  );
}
