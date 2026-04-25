"use client";

import { Children, type ReactNode, useMemo, useState } from "react";
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

export type CommandCenterSummaryCard = {
  id: string;
  title: string;
  value: string;
  caption: string;
  badge: string;
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
  summaryCards: CommandCenterSummaryCard[];
  trends: SiteTrendsPayload;
  topPages: SiteTopPage[];
  issueBreakdown: IssueBreakdownItem[];
  attentionItems: string[];
  activityItems: SiteLiveActivityItem[];
  tabs: CommandCenterTab[];
  children: ReactNode;
};

const cardAccent: Record<CommandCenterSummaryCard["accent"], string> = {
  cyan: "from-cyan-400 to-blue-500",
  blue: "from-blue-500 to-indigo-500",
  violet: "from-violet-500 to-fuchsia-500",
  amber: "from-amber-400 to-orange-400",
  pink: "from-fuchsia-400 to-pink-500",
  slate: "from-slate-400 to-slate-600",
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
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.55)] lg:col-span-2">
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
      <div className="mt-5 h-72 rounded-2xl border border-slate-200/80 bg-white/80 p-3">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={chartData}>
            <CartesianGrid stroke="rgba(15,23,42,0.08)" strokeDasharray="3 3" />
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
            <Line yAxisId="score" type="monotone" dataKey="score" name="SEO health" stroke="var(--brand)" strokeWidth={3} dot={false} />
            <Line yAxisId="issues" type="monotone" dataKey="issues" name="Issues" stroke="var(--wave-cyan)" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function AttentionCard({ items }: { items: string[] }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.55)]">
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
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.55)]">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Top pages</p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">Where attention is landing</h2>
      <div className="mt-4 h-72 rounded-2xl border border-slate-200/80 bg-white/80 p-3">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 54 }}>
              <CartesianGrid stroke="rgba(15,23,42,0.07)" vertical={false} />
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
              <Bar dataKey="views" fill="var(--brand)" radius={[10, 10, 0, 0]} maxBarSize={48} />
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
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.55)]">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-600">Issue mix</p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">Crawl issue breakdown</h2>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
  summaryCards,
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

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {summaryCards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => card.targetTab && setActiveTab(card.targetTab)}
            className="group rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-[0_18px_60px_-42px_rgba(15,23,42,0.7)] transition hover:-translate-y-0.5 hover:border-blue-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          >
            <div className={`h-1.5 rounded-full bg-linear-to-r ${cardAccent[card.accent]}`} aria-hidden />
            <div className="mt-4 flex items-start justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{card.title}</p>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                {card.badge}
              </span>
            </div>
            <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{card.value}</p>
            <p className="mt-2 line-clamp-2 text-sm text-slate-600">{card.caption}</p>
          </button>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <HealthTrendCard trends={trends} />
        <AttentionCard items={attentionItems} />
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <TopPagesCard topPages={topPages} />
        <IssueBreakdownCard issues={issueBreakdown} />
        <CompactActivityCard items={activityItems} />
      </section>

      <section id="details" className="rounded-3xl border border-white/15 bg-white/8 p-2 shadow-[0_24px_90px_-50px_rgba(0,0,0,0.65)] backdrop-blur">
        <div className="flex gap-2 overflow-x-auto p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "border-cyan-200 bg-white text-slate-950 shadow-sm"
                  : "border-white/15 bg-white/10 text-white/72 hover:bg-white/16 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="rounded-[1.35rem] bg-white p-4 shadow-[0_20px_70px_-45px_rgba(15,23,42,0.7)] sm:p-5">
          {panels[activeIndex] ?? null}
        </div>
      </section>
    </div>
  );
}
