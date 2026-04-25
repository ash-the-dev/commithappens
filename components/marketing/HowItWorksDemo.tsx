"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type TabKey = "traffic" | "seo" | "recommendations";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "traffic", label: "Traffic" },
  { key: "seo", label: "SEO issues" },
  { key: "recommendations", label: "Fix queue" },
];

const loadingLines = [
  "Reading tracking events without judging your naming conventions...",
  "Comparing traffic, uptime, and SEO drama...",
  "Ranking fixes by actual business pain...",
  "Turning mystery metrics into plain English...",
];

const trafficPoints = [18, 30, 26, 45, 40, 58, 51, 76, 68, 88, 84, 96];

function pointsForLine(values: number[]): string {
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 100 - value;
      return `${x},${y}`;
    })
    .join(" ");
}

function DonutChart() {
  return (
    <div className="relative mx-auto h-36 w-36">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(#f679d0 0deg 212deg, #22d3ee 212deg 292deg, #a855f7 292deg 336deg, rgba(255,255,255,0.14) 336deg 360deg)",
        }}
      />
      <div className="absolute inset-5 rounded-full border border-white/10 bg-slate-950/95" />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-2xl font-black text-white">82</p>
        <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-white/45">
          Health
        </p>
      </div>
    </div>
  );
}

function TrafficPanel() {
  const points = useMemo(() => pointsForLine(trafficPoints), []);

  return (
    <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-white/45">
            Traffic line graph
          </p>
          <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-xs font-bold text-emerald-200">
            +14%
          </span>
        </div>
        <svg viewBox="0 0 100 100" className="mt-4 h-44 w-full overflow-visible">
          <defs>
            <linearGradient id="trafficLine" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="55%" stopColor="#f679d0" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
            <linearGradient id="trafficFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#f679d0" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#f679d0" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[20, 40, 60, 80].map((y) => (
            <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="0.7" />
          ))}
          <polygon points={`0,100 ${points} 100,100`} fill="url(#trafficFill)" />
          <polyline
            points={points}
            fill="none"
            stroke="url(#trafficLine)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
            className="drop-shadow-[0_0_12px_rgba(246,121,208,0.65)]"
          />
          {trafficPoints.map((value, index) => {
            const x = (index / (trafficPoints.length - 1)) * 100;
            const y = 100 - value;
            return <circle key={`${value}-${index}`} cx={x} cy={y} r="2" fill="#f8a8e6" />;
          })}
        </svg>
      </div>

      <div className="grid gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/7 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-white/45">Top page</p>
          <p className="mt-2 text-lg font-black text-white">/pricing</p>
          <p className="mt-1 text-sm text-white/58">492 visits. Checkout clicks dipped 9%.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/7 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-white/45">Event tracking</p>
          <p className="mt-2 text-lg font-black text-white">Run scan clicked</p>
          <p className="mt-1 text-sm text-white/58">31 conversions. Not bad. Not yacht money.</p>
        </div>
      </div>
    </div>
  );
}

function SeoPanel() {
  return (
    <div className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-white/45">
          Issue mix
        </p>
        <DonutChart />
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-white/62">
          <span>Pink: healthy</span>
          <span>Cyan: redirects</span>
          <span>Purple: missing tags</span>
          <span>Gray: broken</span>
        </div>
      </div>
      <div className="space-y-3">
        {[
          ["Critical", "12 broken pages", "Visitors and crawlers are hitting dead ends. Fix these before polishing anything cute."],
          ["Warning", "Short meta descriptions on 6 pages", "Google may improvise your snippets. Google is many things. Your copywriter is not one of them."],
          ["Notice", "Internal links are thin on blog pages", "Good pages are isolated. Link them before they start a support group."],
        ].map(([level, title, explanation]) => (
          <div key={title} className="rounded-2xl border border-white/10 bg-white/7 p-4">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-brand">{level}</p>
            <p className="mt-1 font-semibold text-white">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-white/58">{explanation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecommendationsPanel() {
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_0.9fr]">
      <div className="rounded-2xl border border-brand/25 bg-brand/10 p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-brand">
          Recommendation example
        </p>
        <p className="mt-3 text-lg font-black text-white">Fix `/pricing` before chasing new traffic.</p>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          Your pricing page is getting visits, but a redirect chain and broken supporting links can leak buyers
          before checkout. Start with the 404s, then shorten the redirect path, then rewrite the meta description.
        </p>
        <div className="mt-4 grid gap-2 text-xs text-white/62 sm:grid-cols-3">
          <span className="rounded-full border border-white/12 bg-black/20 px-3 py-2">Impact: high</span>
          <span className="rounded-full border border-white/12 bg-black/20 px-3 py-2">Effort: medium</span>
          <span className="rounded-full border border-white/12 bg-black/20 px-3 py-2">Why: revenue path</span>
        </div>
      </div>
      <div className="space-y-3">
        {[
          ["Plus point", "Traffic is up 14%, and mobile visitors are sticking around longer."],
          ["Watch item", "Pricing visits are up, but CTA clicks are down. Attention is not commitment."],
          ["Performance", "Response time is healthy. Your host is behaving. For now."],
        ].map(([label, text]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/7 p-4">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-brand">{label}</p>
            <p className="mt-1 text-sm text-white/74">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HowItWorksDemo({ badge = "Most popular" }: { badge?: string }) {
  const [activeTab, setActiveTab] = useState<TabKey>("traffic");
  const [loadingLineIdx, setLoadingLineIdx] = useState(0);
  const [isScanning, setIsScanning] = useState(true);

  useEffect(() => {
    const rotation = window.setInterval(() => {
      setLoadingLineIdx((prev) => (prev + 1) % loadingLines.length);
    }, 2000);
    const done = window.setTimeout(() => setIsScanning(false), 6200);

    return () => {
      window.clearInterval(rotation);
      window.clearTimeout(done);
    };
  }, []);

  return (
    <section className="rounded-[1.75rem] border border-brand/35 bg-slate-950/72 p-4 shadow-[0_32px_100px_-50px_rgba(246,121,208,0.9)] backdrop-blur-xl sm:p-5">
      <div className="relative overflow-hidden rounded-[1.35rem] border border-white/12 bg-white/4 p-4 sm:p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-brand/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-8 h-52 w-52 rounded-full bg-cyan-300/12 blur-3xl" />

        {isScanning ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/72 p-5 backdrop-blur-md">
            <div className="w-full max-w-sm rounded-3xl border border-cyan-200/25 bg-slate-950/92 p-5 shadow-2xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Live demo booting</p>
              <p className="mt-3 text-lg font-black text-white">Building the readout</p>
              <p className="mt-2 min-h-10 text-sm font-semibold leading-relaxed text-cyan-100">
                {loadingLines[loadingLineIdx]}
              </p>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-linear-to-r from-cyan-300 via-brand to-purple-400" />
              </div>
            </div>
          </div>
        ) : null}

        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">
              Mock Committed dashboard
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">acme-demo.com</h2>
            <p className="mt-1 text-sm text-white/55">
              Tracking active. Traffic, uptime, SEO, and recommendations in one cockpit.
            </p>
          </div>
          <span className="rounded-full border border-brand/40 bg-brand/12 px-3 py-1 text-xs font-black text-brand">
            {badge}
          </span>
        </div>

        <div className="relative z-10 mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["Visitors", "1.8k", "+14% this week"],
            ["Uptime", "99.8%", "Avg response 214ms"],
            ["SEO health", "82", "Dropped 18%"],
          ].map(([label, value, caption]) => (
            <button
              key={label}
              type="button"
              className="group rounded-2xl border border-white/10 bg-white/7 p-4 text-left transition hover:-translate-y-0.5 hover:border-brand/45 hover:bg-white/10"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">{label}</p>
              <p className="mt-2 text-3xl font-black text-white">{value}</p>
              <p className="mt-1 text-xs text-brand-muted">{caption}</p>
            </button>
          ))}
        </div>

        <div className="relative z-10 mt-5 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.13em] transition ${
                activeTab === tab.key
                  ? "border-brand bg-brand text-black"
                  : "border-white/18 bg-white/7 text-white/68 hover:border-brand/50 hover:text-brand"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative z-10 mt-5">
          {activeTab === "traffic" ? <TrafficPanel /> : null}
          {activeTab === "seo" ? <SeoPanel /> : null}
          {activeTab === "recommendations" ? <RecommendationsPanel /> : null}
        </div>

        <Link
          href="/pricing"
          className="relative z-10 mt-5 inline-flex w-full justify-center rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-brand-muted"
        >
          Start with Committed
        </Link>
      </div>
    </section>
  );
}
