import { DashboardSection } from "@/components/dashboard/DashboardSection";
import type { SiteAnalytics } from "@/lib/db/analytics";

type Props = {
  domain: string;
  analytics: SiteAnalytics;
};

type SeoSignalStatus = "good" | "watch" | "bad" | "unknown";

function pillClass(status: SeoSignalStatus): string {
  if (status === "good") return "ui-dash-pill ui-dash-pill--good";
  if (status === "bad") return "ui-dash-pill ui-dash-pill--bad";
  if (status === "watch") return "ui-dash-pill ui-dash-pill--mid";
  return "ui-dash-pill";
}

function ratingFromVital(metric: string, avg: number): SeoSignalStatus {
  const m = metric.toUpperCase();
  if (m === "LCP") return avg <= 2500 ? "good" : avg <= 4000 ? "watch" : "bad";
  if (m === "INP") return avg <= 200 ? "good" : avg <= 500 ? "watch" : "bad";
  if (m === "CLS") return avg <= 0.1 ? "good" : avg <= 0.25 ? "watch" : "bad";
  if (m === "FCP") return avg <= 1800 ? "good" : avg <= 3000 ? "watch" : "bad";
  if (m === "TTFB") return avg <= 800 ? "good" : avg <= 1800 ? "watch" : "bad";
  return "unknown";
}

export function SiteSeoHealth({ domain, analytics }: Props) {
  const cwv = analytics.vitalAverages;
  const lcp = cwv.find((v) => v.metric.toUpperCase() === "LCP");
  const inp = cwv.find((v) => v.metric.toUpperCase() === "INP");
  const cls = cwv.find((v) => v.metric.toUpperCase() === "CLS");

  const cwvWorst: SeoSignalStatus =
    cwv.length === 0
      ? "unknown"
      : (() => {
          const ratings = cwv.map((v) => ratingFromVital(v.metric, v.average));
          if (ratings.includes("bad")) return "bad";
          if (ratings.includes("watch")) return "watch";
          if (ratings.includes("good")) return "good";
          return "unknown";
        })();

  const cwvWorstLabel =
    cwvWorst === "good" ? "Looking fine" : cwvWorst === "watch" ? "Needs love" : cwvWorst === "bad" ? "Rough" : "No data";

  const uptimeStatus: SeoSignalStatus = !analytics.uptime.hasChecks24h
    ? "bad"
    : analytics.uptime.uptimePct24h >= 99.5
      ? "good"
      : analytics.uptime.uptimePct24h >= 98
        ? "watch"
        : "bad";

  const topLanding = analytics.topPages[0]?.path ?? null;

  return (
    <DashboardSection
      kicker="SEO ops"
      title="Search doesn’t care about your feelings. It cares about facts."
      subtitle="Operational SEO health: what Google can crawl, what users can load, and what’s quietly sabotaging you."
      meta={
        <span>
          Domain in play: <span className="font-semibold text-slate-900">{domain}</span>
        </span>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Crawl + availability (HTTP)
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                If the site is down, SEO is a fantasy hobby.
              </p>
              <p className="mt-2 text-sm text-slate-700">
                Uptime checks are your early warning for “Google can’t reach this” moments.
              </p>
            </div>
            <span className={pillClass(uptimeStatus)}>
              {uptimeStatus === "good"
                ? "Healthy"
                : uptimeStatus === "watch"
                  ? "Watch"
                  : uptimeStatus === "bad"
                    ? "Risky"
                    : "Unknown"}
            </span>
          </div>

          <p className="mt-3 text-sm text-slate-800">
            <span className="font-semibold">What happened:</span>{" "}
            {analytics.uptime.hasChecks24h
              ? `We ran ${analytics.uptime.checks24h.toLocaleString("en-US")} checks in the last 24 hours.`
              : "No uptime checks in the last 24 hours."}
          </p>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-semibold">Why it matters:</span> downtime and flaky HTTP responses are crawl
            budget poison — and they tank trust with humans too.
          </p>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-semibold">Do this next:</span>{" "}
            {analytics.uptime.hasChecks24h
              ? "If uptime dips, treat it like an incident: confirm DNS, SSL, hosting, and any deploy that touched edge config."
              : "Add an uptime check so you’re not learning about outages from angry tweets."}
          </p>

          <details className="ui-dash-details mt-4 rounded-xl border border-slate-200/80 bg-white/70 p-3">
            <summary className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              For nerds (HTTP + checks)
            </summary>
            <div className="mt-3 space-y-2 text-xs text-slate-700">
              <p>
                <span className="font-semibold">HTTP</span> = the request/response language browsers + bots use
                to fetch pages. Status codes tell you if a URL is reachable, redirected, missing, blocked, etc.
              </p>
              <p>
                <span className="font-semibold">Uptime % (24h)</span>:{" "}
                {analytics.uptime.hasChecks24h
                  ? `${analytics.uptime.uptimePct24h.toFixed(2)}% (${analytics.uptime.checksUp24h}/${analytics.uptime.checks24h} checks up)`
                  : "n/a (no checks yet)"}
              </p>
              <p>
                <span className="font-semibold">Avg response time (24h)</span>:{" "}
                {analytics.uptime.avgResponse24h > 0
                  ? `${Math.round(analytics.uptime.avgResponse24h)}ms`
                  : "n/a"}
              </p>
            </div>
          </details>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Core Web Vitals (CWV)
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                Speed signals Google actually notices.
              </p>
              <p className="mt-2 text-sm text-slate-700">
                CWV is basically “does your site feel fast, stable, and clickable?” — not vanity Lighthouse scores.
              </p>
            </div>
            <span className={pillClass(cwvWorst)}>{cwvWorstLabel}</span>
          </div>

          <p className="mt-3 text-sm text-slate-800">
            <span className="font-semibold">What happened:</span>{" "}
            {cwv.length === 0
              ? "No CWV samples in the last 7 days."
              : `We’ve got CWV samples across ${cwv.length} metric type${cwv.length === 1 ? "" : "s"}.`}
          </p>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-semibold">Why it matters:</span> rough CWV can cap rankings for competitive
            queries — but more importantly, it caps conversions for real humans.
          </p>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-semibold">Do this next:</span>{" "}
            {cwv.length === 0
              ? "Confirm the tracker is installed on the URLs you care about, then generate real traffic on mobile."
              : "If anything is “watch/bad”, start with the worst metric (usually LCP or INP) and fix the top landing templates first."}
          </p>

          <div className="mt-4 space-y-2">
            {[
              {
                label: "LCP · Largest Contentful Paint",
                human: "When the main content finally shows up.",
                row: lcp,
              },
              {
                label: "INP · Interaction to Next Paint",
                human: "How snappy the site feels when someone clicks/taps.",
                row: inp,
              },
              {
                label: "CLS · Cumulative Layout Shift",
                human: "Visual jumpiness while the page loads.",
                row: cls,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-slate-200/80 bg-white/70 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900">{item.label}</p>
                    <p className="mt-1 text-xs text-slate-700">{item.human}</p>
                  </div>
                  {item.row ? (
                    <span className={pillClass(ratingFromVital(item.row.metric, item.row.average))}>
                      avg {item.row.average.toFixed(2)}
                    </span>
                  ) : (
                    <span className={pillClass("unknown")}>n/a</span>
                  )}
                </div>
                {item.row ? (
                  <p className="mt-2 text-xs text-slate-600">
                    Samples (7d): {item.row.samples.toLocaleString("en-US")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Landing pages + demand signals
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                What people actually hit — which is usually what SEO should protect first.
              </p>
              <p className="mt-2 text-sm text-slate-700">
                This is “where your site earns attention” using real traffic, not vibes.
              </p>
            </div>
            <span className={pillClass(topLanding ? "good" : "unknown")}>
              {topLanding ? "Top URL" : "No pages"}
            </span>
          </div>

          <p className="mt-3 text-sm text-slate-800">
            <span className="font-semibold">What happened:</span>{" "}
            {topLanding
              ? `Top page (14d): ${topLanding} (${analytics.topPages[0]?.views.toLocaleString("en-US")} views).`
              : "No pageview paths yet in the last 14 days."}
          </p>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-semibold">Why it matters:</span> SEO wins/loses on a handful of templates. If
            your top URLs are slow, thin, duplicate, or blocked, everything else is theater.
          </p>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-semibold">Do this next:</span> treat your top 5 URLs like product launches:
            titles, intros, internal links, speed, and structured data — in that order.
          </p>

          <details className="ui-dash-details mt-4 rounded-xl border border-slate-200/80 bg-white/70 p-3">
            <summary className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              What we’ll add next (integrations)
            </summary>
            <div className="mt-3 space-y-2 text-xs text-slate-700">
              <p>
                <span className="font-semibold">Google Search Console (GSC)</span> = the closest thing to “what
                Google saw” for impressions/clicks, coverage/indexing issues, and queries/pages.
              </p>
              <p>
                <span className="font-semibold">Screaming Frog</span> = best-in-class crawl exports (chains,
                canonicals, duplicates, indexability). Realistic pattern: scheduled crawl → export → import rows
                (not a live dependency in the product hot path).
              </p>
              <p>
                <span className="font-semibold">PageSpeed / lab</span> = great for reproducible regressions;
                <span className="font-semibold"> RUM</span> (what you already collect) = what real users feel.
              </p>
            </div>
          </details>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          Honest product note (so nobody gets gaslit)
        </p>
        <p className="mt-2 text-sm text-slate-800">
          CommitHappens can already ground SEO conversations in{" "}
          <span className="font-semibold">real traffic</span>,{" "}
          <span className="font-semibold">real performance beacons</span>, and{" "}
          <span className="font-semibold">HTTP uptime</span>. The “indexability / canonical / duplicate /
          robots.txt / sitemap graph” layer needs imported crawl + GSC artifacts — that’s the next engineering
          slice, not a copywriting problem.
        </p>
      </div>
    </DashboardSection>
  );
}
