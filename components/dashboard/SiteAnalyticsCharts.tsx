"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SiteAnalytics } from "@/lib/db/analytics";

function num(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function dec(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

type Props = {
  analytics: SiteAnalytics;
};

export function SiteAnalyticsCharts({ analytics }: Props) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="ui-surface-contrast p-4">
          <p className="text-xs uppercase tracking-wide ui-contrast-muted">Sessions (24h)</p>
          <p className="ui-kpi-value mt-2 text-slate-900">
            {num(analytics.overview.sessions24h)}
          </p>
        </div>
        <div className="ui-surface-contrast p-4">
          <p className="text-xs uppercase tracking-wide ui-contrast-muted">Pageviews (24h)</p>
          <p className="ui-kpi-value mt-2 text-slate-900">
            {num(analytics.overview.pageviews24h)}
          </p>
        </div>
        <div className="ui-surface-contrast p-4">
          <p className="text-xs uppercase tracking-wide ui-contrast-muted">Events (24h)</p>
          <p className="ui-kpi-value mt-2 text-slate-900">
            {num(analytics.overview.events24h)}
          </p>
        </div>
        <div className="ui-surface-contrast p-4">
          <p className="text-xs uppercase tracking-wide ui-contrast-muted">Uptime (24h)</p>
          <p className="ui-kpi-value mt-2 text-slate-900">
            {analytics.uptime.hasChecks24h
              ? `${dec(analytics.uptime.uptimePct24h)}%`
              : "No checks yet"}
          </p>
          <p className="text-xs ui-contrast-muted">
            {analytics.uptime.hasChecks24h
              ? `${num(analytics.uptime.checksUp24h)} / ${num(analytics.uptime.checks24h)} checks`
              : "Configure an uptime check to populate this card"}
          </p>
        </div>
      </section>

      <section className="ui-surface p-5">
        <h3 className="ui-section-title">
          14-day activity
        </h3>
        <div className="ui-surface-soft mt-4 h-72 w-full p-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analytics.timeline}>
              <CartesianGrid
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.2)" }}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.2)" }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(5,5,5,0.92)",
                }}
                labelStyle={{ color: "rgba(255,255,255,0.75)" }}
              />
              <Line
                type="monotone"
                dataKey="sessions"
                name="Sessions"
                stroke="var(--brand)"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="pageviews"
                name="Pageviews"
                stroke="var(--wave-blue)"
                strokeWidth={2.2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="events"
                name="Events"
                stroke="var(--wave-cyan)"
                strokeWidth={2.2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="ui-surface p-5">
          <h3 className="ui-section-title">
            What people actually look at
          </h3>
          <div className="ui-surface-soft mt-4 h-64 w-full p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analytics.topPages}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 20, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  type="number"
                  tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(255,255,255,0.2)" }}
                />
                <YAxis
                  dataKey="path"
                  type="category"
                  width={120}
                  tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(5,5,5,0.92)",
                  }}
                />
                <Bar
                  dataKey="views"
                  name="Views"
                  fill="var(--brand)"
                  radius={[6, 6, 6, 6]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ui-surface p-5">
          <h3 className="ui-section-title">
            Is your site fast... or annoying?
          </h3>
          {analytics.vitalAverages.length === 0 ? (
            <p className="mt-5 text-sm text-white/55">
              We&apos;re not seeing speed data yet. Either no traffic, or something
              isn&apos;t hooked up.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {analytics.vitalAverages.map((vital) => (
                <div
                  key={vital.metric}
                  className="ui-surface-soft p-3"
                >
                  <div className="flex items-end justify-between gap-4">
                    <p className="text-sm font-semibold text-white">{vital.metric}</p>
                    <p className="text-sm text-white/70">avg {dec(vital.average)}</p>
                  </div>
                  <p className="mt-1 text-xs text-white/50">
                    {num(vital.samples)} samples
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="ui-surface-soft mt-4 p-3 text-sm text-white/65">
            How fast your site feels:{" "}
            <span className="text-white">{num(analytics.uptime.avgResponse24h)}ms</span>
          </div>
        </div>
      </section>
    </div>
  );
}
