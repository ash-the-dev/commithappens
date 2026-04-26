"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SiteAnalytics, SiteAnalyticsPoint, SiteVitalAverage } from "@/lib/db/analytics";
import { getMetricExplanation } from "@/lib/seo/crawl/explanations";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";

function num(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function dec(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

type Props = {
  analytics: SiteAnalytics;
};

type MetricKey = "sessions" | "pageviews" | "events";

type SeriesInsight = {
  metric: MetricKey;
  label: string;
  day: string;
  dayLabel: string;
  value: number;
  prev: number;
  pct: number;
  kind: "spike" | "drop" | "flat";
};

type LatestDelta = {
  day: string;
  dayLabel: string;
  metric: MetricKey;
  label: string;
  prev: number;
  value: number;
  pct: number;
  kind: "spike" | "drop" | "flat";
};

function median(values: number[]): number {
  const xs = values.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (xs.length === 0) return 0;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 === 1 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2;
}

function pctChange(prev: number, next: number): number {
  if (prev <= 0) return next > 0 ? 100 : 0;
  return ((next - prev) / prev) * 100;
}

function classifyMove(pct: number): SeriesInsight["kind"] {
  if (pct >= 35) return "spike";
  if (pct <= -25) return "drop";
  return "flat";
}

function latestDayDelta(timeline: SiteAnalyticsPoint[]): LatestDelta | null {
  if (timeline.length < 2) return null;
  const last = timeline[timeline.length - 1]!;
  const prev = timeline[timeline.length - 2]!;
  const rows: LatestDelta[] = (["sessions", "pageviews", "events"] as MetricKey[]).map((key) => {
    const prevValue = prev[key];
    const nextValue = last[key];
    const pct = pctChange(prevValue, nextValue);
    return {
      day: last.day,
      dayLabel: last.label,
      metric: key,
      label: key === "sessions" ? "Sessions" : key === "pageviews" ? "Pageviews" : "Events",
      prev: prevValue,
      value: nextValue,
      pct,
      kind: classifyMove(pct),
    };
  });
  rows.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  return rows[0] ?? null;
}

function trafficQualityNote(a: SiteAnalytics): string {
  const sessions = a.overview.sessions24h;
  const visitors = a.overview.uniqueVisitors24h;
  if (sessions <= 0) return "No sessions in the last 24h — either it’s quiet, or the tracker isn’t everywhere yet.";
  const ratio = visitors / sessions;
  if (ratio >= 0.92) return "Sessions vs unique visitors looks tight — good sign people aren’t bouncing instantly on repeat loads.";
  if (ratio >= 0.75) return "A chunk of sessions are repeat visitors — fine for apps, suspicious for thin landing pages.";
  return "Lots of repeat sessions vs visitors — worth checking if something is double-firing events or reloading aggressively.";
}

type VitalExplain = {
  acronym: string;
  name: string;
  human: string;
  unit: "ms" | "score" | "unknown";
  good: string;
  mid: string;
  bad: string;
};

function explainVital(metric: string): VitalExplain {
  const m = metric.toUpperCase();
  if (m === "LCP") {
    return {
      acronym: "LCP",
      name: "Largest Contentful Paint",
      human: "When the main content finally shows up.",
      unit: "ms",
      good: "≤ 2.5s is generally “nice”",
      mid: "2.5s–4s is “okay but cranky”",
      bad: "> 4s is “people are already mad”",
    };
  }
  if (m === "FCP") {
    return {
      acronym: "FCP",
      name: "First Contentful Paint",
      human: "When the first visible thing appears.",
      unit: "ms",
      good: "≤ 1.8s is usually solid",
      mid: "1.8s–3s is meh",
      bad: "> 3s feels like dial-up cosplay",
    };
  }
  if (m === "INP") {
    return {
      acronym: "INP",
      name: "Interaction to Next Paint",
      human: "How responsive the site feels when someone clicks or taps.",
      unit: "ms",
      good: "≤ 200ms feels snappy",
      mid: "200–500ms starts feeling laggy",
      bad: "> 500ms feels broken",
    };
  }
  if (m === "CLS") {
    return {
      acronym: "CLS",
      name: "Cumulative Layout Shift",
      human: "Visual jumpiness while the page loads.",
      unit: "score",
      good: "≤ 0.1 is stable",
      mid: "0.1–0.25 is annoying",
      bad: "> 0.25 is “stop moving my buttons”",
    };
  }
  if (m === "TTFB") {
    return {
      acronym: "TTFB",
      name: "Time to First Byte",
      human: "How quickly the server starts responding.",
      unit: "ms",
      good: "≤ 800ms is usually fine (depends on geography)",
      mid: "800ms–1.8s is “something’s slow upstream”",
      bad: "> 1.8s is rough for competitive pages",
    };
  }
  return {
    acronym: metric,
    name: metric,
    human: "A performance signal from real browsers.",
    unit: "unknown",
    good: "Lower is usually better (unless it’s a ratio metric).",
    mid: "Depends on the metric — check the nerd panel.",
    bad: "Trending worse than your baseline is worth investigating.",
  };
}

function formatVitalValue(unit: VitalExplain["unit"], avg: number): string {
  if (unit === "score") return dec(avg);
  if (unit === "ms") return `${Math.round(avg).toLocaleString("en-US")}ms`;
  return dec(avg);
}

function vitalBand(v: SiteVitalAverage): "good" | "watch" | "bad" | "unknown" {
  const m = v.metric.toUpperCase();
  const avg = v.average;
  if (m === "LCP") return avg <= 2500 ? "good" : avg <= 4000 ? "watch" : "bad";
  if (m === "INP") return avg <= 200 ? "good" : avg <= 500 ? "watch" : "bad";
  if (m === "CLS") return avg <= 0.1 ? "good" : avg <= 0.25 ? "watch" : "bad";
  if (m === "FCP") return avg <= 1800 ? "good" : avg <= 3000 ? "watch" : "bad";
  if (m === "TTFB") return avg <= 800 ? "good" : avg <= 1800 ? "watch" : "bad";
  return "unknown";
}

function pillClass(kind: "good" | "watch" | "bad" | "unknown"): string {
  if (kind === "good") return "ui-dash-pill ui-dash-pill--good";
  if (kind === "watch") return "ui-dash-pill ui-dash-pill--mid";
  if (kind === "bad") return "ui-dash-pill ui-dash-pill--bad";
  return "ui-dash-pill";
}

function uptimePill(a: SiteAnalytics): { className: string; label: string } {
  if (!a.uptime.hasChecks24h) return { className: pillClass("bad"), label: "No checks" };
  if (a.uptime.uptimePct24h >= 99.5) return { className: pillClass("good"), label: "Up" };
  if (a.uptime.uptimePct24h >= 98) return { className: pillClass("watch"), label: "Shaky" };
  return { className: pillClass("bad"), label: "Down-ish" };
}

const kpiInfoBtn =
  "border-slate-400/50 bg-slate-200/80 text-slate-700 hover:border-slate-500/50 hover:bg-slate-200/95 focus-visible:outline-cyan-700/30";

function KpiCard(props: {
  emphasis?: "none" | "pink" | "green" | "red";
  eyebrow: string;
  title: string;
  value: string;
  happened: string;
  matters: string;
  next: string;
  footnote?: string;
  right?: ReactNode;
  infoMetricKey?: string;
}) {
  const card =
    props.emphasis === "pink"
      ? "ui-dash-card ui-dash-card--pink p-4"
      : props.emphasis === "green"
        ? "ui-dash-card ui-dash-card--green p-4"
        : props.emphasis === "red"
          ? "ui-dash-card ui-dash-card--red p-4"
          : "ui-dash-card p-4";

  return (
    <div className={card}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 pr-1">
          <p className="ui-dash-kicker">{props.eyebrow}</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-600">{props.title}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{props.value}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {props.infoMetricKey ? (
            <InfoTooltip buttonClassName={kpiInfoBtn} {...getMetricExplanation(props.infoMetricKey)} />
          ) : null}
          {props.right ? <div>{props.right}</div> : null}
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-800">
        <span className="font-semibold">What happened:</span> {props.happened}
      </p>
      <p className="mt-2 text-sm text-slate-700">
        <span className="font-semibold">Why it matters:</span> {props.matters}
      </p>
      <p className="mt-2 text-sm text-slate-700">
        <span className="font-semibold">Do this next:</span> {props.next}
      </p>
      {props.footnote ? <p className="mt-3 text-xs text-slate-600">{props.footnote}</p> : null}
    </div>
  );
}

export function SiteAnalyticsCharts({ analytics }: Props) {
  const [rangeDays, setRangeDays] = useState<1 | 7 | 14 | 30>(14);
  const timeline = useMemo(() => {
    if (rangeDays === 1) {
      return analytics.timeline.slice(-2);
    }
    return analytics.timeline.slice(-rangeDays);
  }, [analytics.timeline, rangeDays]);
  const latestPoint = timeline[timeline.length - 1] ?? {
    day: "",
    label: "Latest day",
    sessions: 0,
    pageviews: 0,
    events: 0,
  };
  const latestDeltaInsight = latestDayDelta(timeline);

  const sessionsSeries = timeline.map((d) => d.sessions);
  const baselineSessions = median(sessionsSeries.slice(0, -1));
  const lastSessions = sessionsSeries[sessionsSeries.length - 1] ?? 0;
  const vsBaseline =
    baselineSessions > 0 ? ((lastSessions - baselineSessions) / baselineSessions) * 100 : null;

  const top = analytics.topPages[0] ?? null;
  const totalPageviewsInRange = timeline.reduce((sum, d) => sum + d.pageviews, 0);
  const topShare =
    top && totalPageviewsInRange > 0 ? (top.views / totalPageviewsInRange) * 100 : null;

  const topPagesForChart = useMemo(() => {
    return [...analytics.topPages]
      .sort((a, b) => b.views - a.views)
      .map((p, i) => {
        const full = p.path || "/";
        const short = full.length > 28 ? `${full.slice(0, 12)}…${full.slice(-10)}` : full;
        return {
          path: full,
          short,
          label: `Page ${i + 1}`,
          views: p.views,
        };
      });
  }, [analytics.topPages]);

  const uptime = uptimePill(analytics);

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-600">
        Traffic excludes known search and SEO crawlers (by user agent). Real browsers and visitors without a
        user-agent string are still counted.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          infoMetricKey="sessions"
          eyebrow="Last 24 hours"
          title="Sessions"
          value={num(analytics.overview.sessions24h)}
          happened={`${num(analytics.overview.sessions24h)} sessions in the last 24 hours.`}
          matters="Sessions are the backbone story: demand showed up (or it didn’t)."
          next={
            analytics.overview.sessions24h === 0
              ? "Verify the snippet is on the pages you care about — especially checkout, pricing, and signup."
              : "If sessions move hard day-over-day, compare it to deploys, ads, email sends, and anything SEO-ish."
          }
          footnote={`${trafficQualityNote(analytics)} Latest day bucket (${latestPoint.label}): ${num(latestPoint.sessions)}.`}
        />

        <KpiCard
          infoMetricKey="pageviews"
          eyebrow="Last 24 hours"
          title="Pageviews"
          value={num(analytics.overview.pageviews24h)}
          happened={`${num(analytics.overview.pageviews24h)} pageviews in the last 24 hours.`}
          matters="Pageviews tell you whether people actually wandered your site or bounced after one screen."
          next={
            analytics.overview.pageviews24h === 0
              ? "If sessions exist but pageviews don’t, something’s weird with navigation, SPA routing, or tracking coverage."
              : "Pair this with top pages: if pageviews climb but conversions don’t, you’ve got a content/UX problem."
          }
          footnote={`Latest day bucket (${latestPoint.label}): ${num(latestPoint.pageviews)}.`}
        />

        <KpiCard
          infoMetricKey="events"
          eyebrow="Last 24 hours"
          title="Events"
          value={num(analytics.overview.events24h)}
          happened={`${num(analytics.overview.events24h)} custom events in the last 24 hours.`}
          matters="Events are how you prove “this click mattered” beyond vanity traffic."
          next={
            analytics.overview.events24h === 0
              ? "If you care about conversions, add explicit events for signup, checkout, lead submit, etc."
              : "Pick one funnel event and watch it alongside sessions — traffic without outcomes is just vibes."
          }
          footnote={`Latest day bucket (${latestPoint.label}): ${num(latestPoint.events)}.`}
        />

        <KpiCard
          infoMetricKey="uptime"
          emphasis={analytics.uptime.hasChecks24h ? undefined : "red"}
          eyebrow="Last 24 hours"
          title="Uptime (HTTP checks)"
          value={
            analytics.uptime.hasChecks24h ? `${dec(analytics.uptime.uptimePct24h)}%` : "No checks"
          }
          happened={
            analytics.uptime.hasChecks24h
              ? `${num(analytics.uptime.checksUp24h)} / ${num(analytics.uptime.checks24h)} checks succeeded.`
              : "No uptime checks ran — so we can’t prove the site stayed reachable."
          }
          matters="If this thing dies, you’re waiting for customers to tell you. Hope is not a monitoring strategy."
          next={
            analytics.uptime.hasChecks24h
              ? "If uptime isn’t basically perfect, treat it like an incident — DNS, SSL, hosting, deploys, redirects."
              : "Add an uptime check. Brave is a fun personality trait; not a monitoring strategy."
          }
          right={<span className={uptime.className}>{uptime.label}</span>}
          footnote={
            analytics.uptime.hasChecks24h
              ? `Avg response time (24h): ${Math.round(analytics.uptime.avgResponse24h)}ms`
              : undefined
          }
        />
      </div>

      <div className="ui-dash-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="ui-dash-kicker">
              {rangeDays === 1 ? "Daily story" : `${rangeDays}-day story`}
            </p>
            <h3 className="ui-dash-title">
              {rangeDays === 1 ? "Traffic daily view" : `Traffic over the last ${rangeDays} days`}
            </h3>
            <p className="ui-dash-subtitle">
              Here’s when people actually showed up — and whether anything changed after your latest update (or ad
              spend, or SEO luck).
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-2">
              {([
                { key: 1 as const, label: "Daily" },
                { key: 7 as const, label: "7d" },
                { key: 14 as const, label: "14d" },
                { key: 30 as const, label: "30d" },
              ]).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setRangeDays(item.key)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    rangeDays === item.key
                      ? "border-slate-900/25 bg-slate-900/10 text-slate-900"
                      : "border-slate-200/80 bg-white/70 text-slate-700 hover:bg-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <span className="rounded-full border border-emerald-300/50 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-800">
              Visits (30d): {num(analytics.overview.sessions30d)}
            </span>
            <span className={pillClass("unknown")}>Legend</span>
            <div className="flex flex-wrap justify-end gap-2 text-xs text-slate-700">
              <span className="rounded-full border border-slate-200/80 bg-white/70 px-2 py-1 font-semibold">
                <span style={{ color: "var(--brand)" }}>●</span> Sessions
              </span>
              <span className="rounded-full border border-slate-200/80 bg-white/70 px-2 py-1 font-semibold">
                <span style={{ color: "var(--wave-blue)" }}>●</span> Pageviews
              </span>
              <span className="rounded-full border border-slate-200/80 bg-white/70 px-2 py-1 font-semibold">
                <span style={{ color: "var(--wave-cyan)" }}>●</span> Events
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4">
          <p className="text-sm font-semibold text-slate-900">The takeaway</p>
          <p className="mt-2 text-sm text-slate-800">
            {latestDeltaInsight ? (
              <>
                Latest day change:{" "}
                <span className="font-semibold">
                  {latestDeltaInsight.label}{" "}
                  {latestDeltaInsight.kind === "spike"
                    ? "spiked"
                    : latestDeltaInsight.kind === "drop"
                      ? "dropped"
                      : "was flat"}{" "}
                  on {latestDeltaInsight.dayLabel}
                </span>{" "}
                ({latestDeltaInsight.prev.toLocaleString("en-US")} →{" "}
                {latestDeltaInsight.value.toLocaleString("en-US")},{" "}
                {latestDeltaInsight.pct > 0 ? "+" : ""}
                {latestDeltaInsight.pct.toFixed(0)}%).
              </>
            ) : (
              <>Nothing dramatic day-over-day — either steady, or not enough signal yet.</>
            )}
          </p>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-semibold">Why this matters:</span> spikes/drops are how you catch broken
            campaigns, accidental deploys, SEO surprises, or bots being bots.
          </p>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-semibold">Do this next:</span> if you see a spike, validate it’s real humans (not
            a tracking double-fire). If you see a drop, check uptime + top landing pages first.
          </p>
          {vsBaseline !== null ? (
            <p className="mt-3 text-xs text-slate-600">
              Baseline check: last day sessions vs median of prior days ≈{" "}
              <span className="font-semibold">
                {vsBaseline > 0 ? "+" : ""}
                {vsBaseline.toFixed(0)}%
              </span>
              .
            </p>
          ) : null}
        </div>

        <div className="ui-chart-shell mt-4 h-68 w-full p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeline}>
              <CartesianGrid stroke="rgba(15,23,42,0.055)" strokeDasharray="2 6" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "rgba(15,23,42,0.62)", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "rgba(15,23,42,0.18)" }}
              />
              <YAxis
                tick={{ fill: "rgba(15,23,42,0.62)", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "rgba(15,23,42,0.18)" }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,0.12)",
                  background: "rgba(255,255,255,0.96)",
                }}
                labelStyle={{ color: "rgba(15,23,42,0.75)", fontWeight: 700 }}
              />
              <Legend
                wrapperStyle={{ color: "rgba(15,23,42,0.72)", fontSize: 12, paddingTop: 8 }}
                formatter={(value) => <span className="text-slate-700">{String(value)}</span>}
              />
              {latestDeltaInsight ? (
                <ReferenceLine
                  x={latestDeltaInsight.dayLabel}
                  stroke={
                    latestDeltaInsight.kind === "spike"
                      ? "rgba(244,63,94,0.55)"
                      : latestDeltaInsight.kind === "drop"
                        ? "rgba(59,130,246,0.55)"
                        : "rgba(100,116,139,0.5)"
                  }
                  strokeDasharray="4 4"
                  label={{
                    value:
                      latestDeltaInsight.kind === "spike"
                        ? "Latest spike"
                        : latestDeltaInsight.kind === "drop"
                          ? "Latest drop"
                          : "Latest steady",
                    position: "top",
                    fill: "rgba(15,23,42,0.65)",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="sessions"
                name="Sessions (visits that started)"
                stroke="var(--brand)"
                strokeWidth={1.9}
                dot={false}
                isAnimationActive
                animationDuration={700}
              />
              <Line
                type="monotone"
                dataKey="pageviews"
                name="Pageviews (pages loaded)"
                stroke="var(--wave-blue)"
                strokeWidth={1.8}
                dot={false}
                isAnimationActive
                animationDuration={700}
              />
              <Line
                type="monotone"
                dataKey="events"
                name="Events (things you track on purpose)"
                stroke="var(--wave-cyan)"
                strokeWidth={1.8}
                dot={false}
                isAnimationActive
                animationDuration={700}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            Definitions
          </p>
          <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-3">
            <p>
              <span className="font-semibold">Sessions</span> = a bucket of activity that belongs to one visit
              story (best-effort in the real world).
            </p>
            <p>
              <span className="font-semibold">Pageviews</span> = pages actually loaded.
            </p>
            <p>
              <span className="font-semibold">Events</span> = custom signals you chose to measure (clicks, signups,
              checkout steps).
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="ui-dash-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 pr-1">
              <p className="ui-dash-kicker">Demand map</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <h3 className="ui-dash-title mt-0! text-base! sm:text-lg!">Top pages (last 14 days)</h3>
                <InfoTooltip buttonClassName={kpiInfoBtn} {...getMetricExplanation("seo_top_pages_bars")} />
              </div>
            </div>
          </div>
          <p className="ui-dash-subtitle mt-1!">
            Where attention pooled — protect these URLs like they pay rent (because they do).
          </p>

          <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4">
            <p className="text-sm font-semibold text-slate-900">The takeaway</p>
            <p className="mt-2 text-sm text-slate-800">
              {top ? (
                <>
                  Headliner:{" "}
                  <span className="font-semibold">
                    {top.path}
                  </span>{" "}
                  with {num(top.views)} views
                  {topShare !== null ? (
                    <>
                      {" "}
                      (~{topShare.toFixed(0)}% of pageviews in this 14-day window)
                    </>
                  ) : null}
                  .
                </>
              ) : (
                <>No pageviews yet — the internet hasn’t RSVP’d.</>
              )}
            </p>
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-semibold">Why this matters:</span> if your top pages are slow, confusing, or
              broken, you’re leaking money quietly.
            </p>
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-semibold">Do this next:</span> open the top 3 paths on mobile and be honest
              about the first 5 seconds.
            </p>
          </div>

          <div className="ui-chart-shell mt-4 h-72 w-full p-2 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topPagesForChart}
                margin={{ top: 8, right: 8, left: 4, bottom: 88 }}
                barCategoryGap="18%"
              >
                <CartesianGrid stroke="rgba(15,23,42,0.055)" vertical={false} strokeDasharray="2 6" />
                <XAxis
                  dataKey="short"
                  type="category"
                  tick={{ fill: "rgba(15,23,42,0.68)", fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(15,23,42,0.1)" }}
                  interval={0}
                  height={64}
                  angle={-32}
                  textAnchor="end"
                />
                <YAxis
                  tick={{ fill: "rgba(15,23,42,0.55)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(56, 189, 248, 0.07)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const row = payload[0].payload as (typeof topPagesForChart)[0];
                    return (
                      <div className="max-w-sm rounded-xl border border-slate-200/80 bg-white/98 px-3 py-2 text-xs shadow-lg backdrop-blur">
                        <p className="font-mono text-[11px] font-semibold leading-snug text-slate-800">{row.path}</p>
                        <p className="mt-1 text-slate-600">
                          <span className="font-semibold text-slate-900">{num(row.views)}</span> pageviews
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="views"
                  name="Pageviews"
                  fill="url(#barGrad)"
                  fillOpacity={0.74}
                  radius={[8, 8, 0, 0]}
                  maxBarSize={34}
                  isAnimationActive
                  animationDuration={650}
                >
                  <LabelList
                    dataKey="views"
                    position="top"
                    style={{ fontSize: 10, fill: "rgba(15,23,42,0.65)", fontWeight: 600 }}
                    formatter={(v) => num(Number(v))}
                  />
                </Bar>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="color-mix(in srgb, var(--brand) 86%, white)" />
                    <stop offset="100%" stopColor="color-mix(in srgb, var(--brand) 35%, #e2e8f0)" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ui-dash-card relative p-5 sm:p-6">
          <div className="absolute right-3 top-3 z-10 sm:right-5 sm:top-4">
            <InfoTooltip buttonClassName={kpiInfoBtn} {...getMetricExplanation("web_vitals")} />
          </div>
          <p className="ui-dash-kicker">Real-user speed</p>
          <h3 className="ui-dash-title pr-7 sm:pr-8">Core Web Vitals (last 7 days)</h3>
          <p className="ui-dash-subtitle">
            Google-y performance signals, translated into human: “fast, stable, clickable — or not.”
          </p>

          {analytics.vitalAverages.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4">
              <p className="text-sm font-semibold text-slate-900">The takeaway</p>
              <p className="mt-2 text-sm text-slate-800">No CWV samples yet.</p>
              <p className="mt-2 text-sm text-slate-700">
                <span className="font-semibold">Why it matters:</span> you can’t optimize what you aren’t measuring
                from real browsers.
              </p>
              <p className="mt-2 text-sm text-slate-700">
                <span className="font-semibold">Do this next:</span> ship the tracker on real pages, generate
                traffic, and come back after a day.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {analytics.vitalAverages.map((vital) => {
                const expl = explainVital(vital.metric);
                const band = vitalBand(vital);
                return (
                  <div key={vital.metric} className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-slate-950">
                          {expl.acronym} · {expl.name}
                        </p>
                        <p className="mt-1 text-sm text-slate-700">{expl.human}</p>
                      </div>
                      <span className={pillClass(band)}>{band === "unknown" ? "n/a" : band}</span>
                    </div>

                    <p className="mt-3 text-sm text-slate-800">
                      <span className="font-semibold">What happened:</span> avg {formatVitalValue(expl.unit, vital.average)} across{" "}
                      {num(vital.samples)} samples.
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      <span className="font-semibold">Why it matters:</span> rough UX shows up in bounce rates,
                      conversions, and (sometimes) search visibility.
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      <span className="font-semibold">Do this next:</span> if this metric is “watch/bad”, profile
                      the slow pages and fix the biggest template issues first.
                    </p>

                    <div className="mt-3 rounded-xl border border-slate-200/80 bg-white/70 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                        Thresholds + raw average
                      </p>
                      <div className="mt-3 space-y-2 text-xs text-slate-700">
                        <p>
                          <span className="font-semibold">Rule-of-thumb bands:</span> {expl.good} · {expl.mid} ·{" "}
                          {expl.bad}
                        </p>
                        <p>
                          <span className="font-semibold">Raw average (as stored)</span>: {vital.average}
                        </p>
                        <p className="text-slate-600">
                          These are directional, not a courtroom. Geography, devices, and page types all change what
                          “good” feels like.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="relative mt-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4 pr-10">
            <div className="absolute right-2 top-2 z-10 sm:right-3 sm:top-3">
              <InfoTooltip buttonClassName={kpiInfoBtn} {...getMetricExplanation("response_time")} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Server responsiveness (uptime probe)
            </p>
            <p className="mt-2 text-sm text-slate-800">
              <span className="font-semibold">TTFB-ish reality check:</span>{" "}
              <span className="font-semibold">
                {analytics.uptime.avgResponse24h > 0
                  ? `${Math.round(analytics.uptime.avgResponse24h)}ms`
                  : "n/a"}
              </span>{" "}
              average response time from uptime checks in the last 24h.
            </p>
            <p className="mt-2 text-xs text-slate-600">
              This is not the same as browser{" "}
              <span className="font-semibold">TTFB</span> (Time to First Byte) from real users — it’s your monitor’s
              view of “how fast did the server wake up?”
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
