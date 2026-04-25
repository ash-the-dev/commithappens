import Link from "next/link";
import { DeleteSiteButton } from "@/components/dashboard/DeleteSiteButton";
import type { DashboardSiteSnapshot } from "@/lib/db/dashboard";

type Props = {
  site: DashboardSiteSnapshot;
};

function formatRelative(iso: string | null): string {
  if (!iso) return "Nothing useful yet";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Nothing useful yet";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function metricDelta(delta: number | null): string {
  if (delta === null) return "No comparison yet";
  if (delta === 0) return "No movement";
  return delta > 0 ? `+${delta}` : String(delta);
}

function healthDelta(delta: number | null): string {
  if (delta === null) return "No comparison yet";
  if (delta === 0) return "No movement";
  return delta > 0 ? `+${delta}%` : `${delta}%`;
}

function stateTone(site: DashboardSiteSnapshot): {
  border: string;
  badge: string;
  label: string;
} {
  if (!site.isActive) {
    return {
      border: "border-slate-200",
      badge: "bg-slate-100 text-slate-700 border-slate-200",
      label: "Paused",
    };
  }
  if (site.healthScore !== null && site.healthScore >= 90 && (site.issuesCurrent ?? 0) === 0) {
    return {
      border: "border-blue-200",
      badge: "bg-blue-50 text-blue-700 border-blue-200",
      label: "Healthy",
    };
  }
  if (site.healthScore !== null && site.healthScore < 75) {
    return {
      border: "border-amber-200",
      badge: "bg-amber-50 text-amber-700 border-amber-200",
      label: "Needs attention",
    };
  }
  return {
    border: "border-violet-200",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
    label: "Warning",
  };
}

export function SiteCard({ site }: Props) {
  const tone = stateTone(site);
  const hasCrawlData = site.healthScore !== null || site.issuesCurrent !== null || site.healthyPages !== null;
  const hasIssues = (site.issuesCurrent ?? 0) > 0 || Boolean(site.topIssue);
  const issuePanel = hasIssues
    ? {
        label: "Top issue",
        text: site.topIssue ?? `${site.issuesCurrent} things we should probably deal with.`,
        className: "border-l-amber-400 bg-slate-50",
      }
    : hasCrawlData
      ? {
          label: "Clean for now",
          text: "No top issue found. Annoyingly well-behaved.",
          className: "border-l-blue-400 bg-blue-50/70",
        }
      : {
          label: "Crawl needed",
          text: "Nothing crawled yet. Run SEO crawl and let’s fix that.",
          className: "border-l-violet-400 bg-slate-50",
        };

  return (
    <li
      className={`group relative overflow-hidden rounded-3xl border bg-white p-5 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.55)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_28px_80px_-50px_rgba(59,130,246,0.45)] sm:p-6 ${tone.border}`}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_40%,color-mix(in_srgb,var(--brand)_8%,transparent)_50%,transparent_60%)] opacity-0 transition duration-500 group-hover:opacity-100"
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold tracking-tight text-slate-950">{site.name}</p>
          <p className="mt-1 truncate text-sm text-blue-600">{site.domain}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone.badge}`}>{tone.label}</span>
      </div>

      <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/35 bg-linear-to-b from-white/95 to-white/88 p-3 shadow-sm ring-1 ring-white/20">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Health score</p>
          <p className="ui-kpi-value mt-1 text-slate-900">
            {site.healthScore !== null ? `${site.healthScore}%` : "Nothing yet"}
          </p>
          <p className="mt-1 text-xs text-slate-600">{healthDelta(site.healthDelta)}</p>
        </div>
        <div className="rounded-2xl border border-white/35 bg-linear-to-b from-white/95 to-white/88 p-3 shadow-sm ring-1 ring-white/20">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Issues</p>
          <p className="ui-kpi-value mt-1 text-slate-900">
            {site.issuesCurrent !== null ? site.issuesCurrent : "Nothing yet"}
          </p>
          <p className="mt-1 text-xs text-slate-600">{metricDelta(site.issuesDelta)}</p>
        </div>
        <div className="rounded-2xl border border-white/35 bg-linear-to-b from-white/95 to-white/88 p-3 shadow-sm ring-1 ring-white/20">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Healthy pages</p>
          <p className="ui-kpi-value mt-1 text-slate-900">
            {site.healthyPages !== null ? site.healthyPages : "Nothing yet"}
          </p>
          <p className="mt-1 text-xs text-slate-600">From latest crawl report</p>
        </div>
      </div>

      <div className={`relative mt-4 rounded-2xl border-l-4 border-y-slate-200 border-r-slate-200 p-3 shadow-sm ${issuePanel.className}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {hasIssues ? "△ " : ""}
          {issuePanel.label}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-700">{issuePanel.text}</p>
      </div>

      <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <p>Last checked: {formatRelative(site.lastCheckedAt)}</p>
        <p>Last activity: {formatRelative(site.lastSeenAt)}</p>
        <p>
          Visits (24h):{" "}
          {site.visits24h !== null ? site.visits24h.toLocaleString("en-US") : "Nothing yet"}
        </p>
        <p>
          Pageviews (24h):{" "}
          {site.pageviews24h !== null ? site.pageviews24h.toLocaleString("en-US") : "Nothing yet"}
        </p>
        <p>
          Visits (30d):{" "}
          {site.visits30d !== null ? site.visits30d.toLocaleString("en-US") : "Nothing yet"}
        </p>
      </div>

      <div className="relative mt-5 flex flex-wrap items-center gap-2">
        <Link
          href={`/dashboard/sites/${site.id}`}
          className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-black shadow-sm transition hover:bg-brand-muted"
        >
          View report
        </Link>
        <Link
          href={`/dashboard/sites/${site.id}#seo-crawl`}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50"
        >
          Run SEO crawl
        </Link>
        <DeleteSiteButton siteId={site.id} siteName={site.name} compact />
      </div>
    </li>
  );
}
