"use client";

import { Children, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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

function HealthTrendCard({ trends }: { trends: SiteTrendsPayload }) {
  const chartData = trends.seoHealth.map((point, index) => ({
    label: point.label,
    score: point.score,
    issues: trends.issues[index]?.count ?? 0,
  }));

  return (
    <article className="ui-fade-in rounded-3xl border border-slate-200/70 bg-(--card-solid-bg) p-5 shadow-[0_22px_60px_-46px_rgba(15,23,42,0.5)] lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">SEO command chart</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Health and issues over time</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Compact crawl trend, focused on whether health is improving and issue volume is cooling off.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {trends.source === "demo" ? "Sample data" : trends.source === "partial" ? "Partial data" : "Stored data"}
        </span>
      </div>
      <div className="ui-chart-shell mt-5 h-64 min-h-64 p-2">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={220}>
          <LineChart data={chartData}>
            <CartesianGrid stroke="rgba(15,23,42,0.055)" strokeDasharray="2 6" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} />
            <YAxis yAxisId="score" domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} />
            <YAxis yAxisId="issues" orientation="right" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} />
            <Tooltip
              contentStyle={{
                border: "1px solid rgba(15,23,42,0.12)",
                borderRadius: 12,
                background: "rgba(255,255,255,0.98)",
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line yAxisId="score" type="monotone" dataKey="score" name="SEO health" stroke="var(--brand)" strokeWidth={1.9} dot={false} isAnimationActive animationDuration={700} />
            <Line yAxisId="issues" type="monotone" dataKey="issues" name="Issues" stroke="var(--wave-cyan)" strokeWidth={1.8} dot={false} isAnimationActive animationDuration={700} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function AttentionCard({ items }: { items: string[] }) {
  return (
    <article className="ui-fade-in rounded-3xl border border-slate-200/70 bg-(--card-solid-bg) p-5 shadow-[0_22px_60px_-46px_rgba(15,23,42,0.5)]">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-600">Needs attention</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">What to look at now</h2>
      <div className="mt-4 space-y-3">
        {items.length > 0 ? (
          items.slice(0, 4).map((item, index) => (
            <div key={`${item}-${index}`} className="flex gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-white text-sm font-black text-amber-700">
                !
              </span>
              <p className="text-sm leading-relaxed text-slate-800">{item}</p>
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
        label: page.path.length > 22 ? `${page.path.slice(0, 10)}...${page.path.slice(-8)}` : page.path || "/",
        path: page.path || "/",
        views: page.views,
        rank: `#${index + 1}`,
      })),
    [topPages],
  );

  return (
    <article className="ui-fade-in rounded-3xl border border-slate-200/70 bg-(--card-solid-bg) p-5 shadow-[0_22px_60px_-46px_rgba(15,23,42,0.5)]">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Top pages</p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">Where attention is landing</h2>
      <div className="ui-chart-shell mt-4 h-64 min-h-64 p-2">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={220}>
            <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 54 }}>
              <CartesianGrid stroke="rgba(15,23,42,0.055)" strokeDasharray="2 6" vertical={false} />
              <XAxis dataKey="label" angle={-28} textAnchor="end" height={58} tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} />
              <Tooltip
                cursor={{ fill: "rgba(59,130,246,0.08)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const row = payload[0].payload as (typeof data)[0];
                  return (
                    <div className="max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                      <p className="font-mono font-semibold text-slate-900">{row.path}</p>
                      <p className="mt-1 text-slate-600">{row.views.toLocaleString("en-US")} pageviews</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="views" fill="var(--brand)" fillOpacity={0.72} radius={[8, 8, 0, 0]} maxBarSize={34} isAnimationActive animationDuration={650} />
            </BarChart>
          </ResponsiveContainer>
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
  const data = total > 0 ? issues : [{ name: "No issues", value: 1 }];

  return (
    <article className="ui-fade-in rounded-3xl border border-slate-200/70 bg-(--card-solid-bg) p-5 shadow-[0_22px_60px_-46px_rgba(15,23,42,0.5)]">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-600">Issue mix</p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">Crawl issue breakdown</h2>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={220}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={54} outerRadius={86} paddingAngle={2}>
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={total > 0 ? donutColors[index % donutColors.length] : "#cbd5e1"} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 grid gap-2 text-xs text-slate-600">
        {issues.map((item, index) => (
          <div key={item.name} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: donutColors[index % donutColors.length] }} />
              {item.name}
            </span>
            <span className="font-semibold text-slate-900">{item.value}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function CompactActivityCard({ items }: { items: SiteLiveActivityItem[] }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.55)]">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-600">Recent activity</p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">Latest tracked events</h2>
      <div className="mt-4 space-y-2">
        {items.length > 0 ? (
          items.slice(0, 5).map((item) => (
            <div key={`${item.type}-${item.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">{item.label}</p>
                  <p className="mt-1 truncate font-mono text-xs text-slate-500">{item.path ?? item.type}</p>
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
            onClick={() => card.targetTab && activateTab(card.targetTab, true)}
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
