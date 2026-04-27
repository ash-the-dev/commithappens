"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SiteTrendsPayload } from "@/lib/dashboard/site-trends";
import { getMetricExplanation } from "@/lib/seo/crawl/explanations";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";

const kpiBtn =
  "h-4 w-4 min-h-4 min-w-4 border-slate-400/50 bg-slate-200/80 text-slate-700 hover:border-slate-500/50";

const CHART_H = 180;
const REFRESH_MS = 50_000;

type Props = {
  websiteId: string;
  initial: SiteTrendsPayload;
};

function TrendCard(props: {
  kicker: string;
  title: string;
  subtitle: string;
  infoKey: string;
  data: Array<Record<string, string | number | null>>;
  yKey: string;
  yDomain?: [number, number];
  valueFmt: (v: number) => string;
  stroke: string;
  lastUpdated: string;
  connectNulls?: boolean;
}) {
  return (
    <div className="ui-dash-card ui-fade-in flex min-h-0 flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 pr-1">
          <p className="ui-dash-kicker">{props.kicker}</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <h3 className="ui-dash-title mt-0! text-base!">{props.title}</h3>
            <InfoTooltip buttonClassName={kpiBtn} {...getMetricExplanation(props.infoKey)} />
          </div>
          <p className="ui-dash-subtitle mt-0.5! text-xs!">{props.subtitle}</p>
        </div>
        <p className="shrink-0 text-[0.65rem] text-slate-500" title={props.lastUpdated}>
          {props.lastUpdated.slice(0, 10)}
        </p>
      </div>
      <div className="ui-chart-shell mt-2 min-h-56 flex-1 p-2" style={{ height: CHART_H }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={160}>
          <LineChart data={props.data} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="rgba(15,23,42,0.055)" strokeDasharray="2 6" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "rgba(15,23,42,0.55)", fontSize: 10 }}
              tickLine={false}
              height={32}
              interval="preserveStartEnd"
            />
            <YAxis
              {...(props.yDomain != null ? { domain: props.yDomain } : {})}
              width={40}
              tick={{ fill: "rgba(15,23,42,0.55)", fontSize: 10 }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.1)",
                background: "rgba(255,255,255,0.97)",
                fontSize: 12,
              }}
              formatter={(value) => {
                if (value == null) return ["—", props.title];
                const n = typeof value === "number" ? value : Number(value);
                if (!Number.isFinite(n)) return ["—", props.title];
                return [props.valueFmt(n), props.title] as [string, string];
              }}
            />
            <Line
              type="monotone"
              dataKey={props.yKey}
              stroke={props.stroke}
              strokeWidth={1.8}
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 0 }}
              isAnimationActive
              animationDuration={700}
              connectNulls={props.connectNulls ?? true}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function SiteReportTrendCharts({ websiteId, initial }: Props) {
  const rid = useId();
  const [payload, setPayload] = useState<SiteTrendsPayload>(initial);
  const [pollError, setPollError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTrends = useCallback(async () => {
    const res = await fetch(`/api/dashboard/site-trends?website_id=${encodeURIComponent(websiteId)}`, {
      method: "GET",
    });
    if (!res.ok) {
      setPollError("Trends didn’t refresh. Showing the last snapshot that behaved.");
      return;
    }
    const data = (await res.json()) as { ok?: boolean; trends?: SiteTrendsPayload };
    if (data.trends) {
      setPayload(data.trends);
      setPollError(null);
    }
  }, [websiteId]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      void fetchTrends();
    }, REFRESH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchTrends]);

  const seo = payload.seoHealth.map((d) => ({ label: d.label, score: d.score, at: d.at }));
  const iss = payload.issues.map((d) => ({ label: d.label, count: d.count, at: d.at }));
  const up = payload.uptime.map((d) => ({ label: d.label, pct: d.pct, at: d.at }));
  const rt = payload.responseMs.map((d) => ({ label: d.label, ms: d.ms, at: d.at }));

  const sourceLabel =
    payload.source === "demo" ? "Sample curve — your real crawl history will paint this" : "Live mix";

  return (
    <section
      className="ui-fade-in rounded-3xl border border-slate-200/70 bg-(--card-solid-bg) p-4 shadow-[0_22px_60px_-46px_rgba(15,23,42,0.5)] sm:p-5"
      aria-labelledby={`${rid}-trends-h`}
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id={`${rid}-trends-h`} className="text-lg font-semibold text-slate-950">
            Health trends
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Auto-refreshes about every 50s. {sourceLabel} (
            {payload.source === "partial" || payload.source === "demo" ? "we blend demo where data is still thin" : "pulled from your latest crawls and monitors"}
            ).
          </p>
        </div>
        {pollError ? <p className="text-xs text-amber-700 sm:max-w-xs sm:text-right">{pollError}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TrendCard
          kicker="Crawl / SEO"
          title="Health score"
          subtitle="0–100 from each stored crawl. More crawls, smoother story."
          infoKey="trend_seo_health"
          data={seo}
          yKey="score"
          yDomain={[0, 100]}
          valueFmt={(v) => `${Math.round(v)} pts`}
          stroke="var(--brand)"
          lastUpdated={payload.generatedAt}
        />
        <TrendCard
          kicker="Crawl / SEO"
          title="Notices, warnings, & criticals"
          subtitle="Total issue-class signals we counted per run — lower tends to be calmer."
          infoKey="trend_seo_issues"
          data={iss}
          yKey="count"
          valueFmt={(v) => `${Math.round(v)} open signals`}
          stroke="var(--wave-cyan)"
          lastUpdated={payload.generatedAt}
        />
        <TrendCard
          kicker="Uptime"
          title="Check outcomes"
          subtitle="100 = monitor saw “up” for a probe; 0 = hard miss. Bouncy is worth investigating."
          infoKey="trend_uptime_probe"
          data={up}
          yKey="pct"
          yDomain={[0, 100]}
          valueFmt={(v) => `${Math.round(v)}%`}
          stroke="var(--wave-blue)"
          lastUpdated={payload.generatedAt}
        />
        <TrendCard
          kicker="Performance"
          title="Response time (probe)"
          subtitle="From uptime checks — a hint, not a full lab test. Gaps = missing timing."
          infoKey="trend_response_probe"
          data={rt}
          yKey="ms"
          valueFmt={(v) => (Number.isFinite(v) ? `${Math.round(v)}ms` : "—")}
          stroke="#a78bfa"
          lastUpdated={payload.generatedAt}
          connectNulls={false}
        />
      </div>
    </section>
  );
}
