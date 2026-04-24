import Link from "next/link";
import { DeleteSiteButton } from "@/components/dashboard/DeleteSiteButton";
import type { DashboardSiteSnapshot } from "@/lib/db/dashboard";

type Props = {
  site: DashboardSiteSnapshot;
};

function formatRelative(iso: string | null): string {
  if (!iso) return "No data available yet";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "No data available yet";
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
  if (delta === 0) return "No change";
  return delta > 0 ? `+${delta}` : String(delta);
}

function healthDelta(delta: number | null): string {
  if (delta === null) return "No comparison yet";
  if (delta === 0) return "No change";
  return delta > 0 ? `+${delta}%` : `${delta}%`;
}

function stateTone(site: DashboardSiteSnapshot): {
  border: string;
  badge: string;
  label: string;
} {
  if (!site.isActive) {
    return {
      border: "border-white/20",
      badge: "bg-slate-300/15 text-slate-200 border-slate-300/35",
      label: "Paused",
    };
  }
  if (site.healthScore !== null && site.healthScore >= 90 && (site.issuesCurrent ?? 0) === 0) {
    return {
      border: "border-emerald-300/45 shadow-[0_0_40px_-28px_rgba(16,185,129,0.95)]",
      badge: "bg-emerald-300/15 text-emerald-100 border-emerald-300/45",
      label: "Healthy",
    };
  }
  if (site.healthScore !== null && site.healthScore < 75) {
    return {
      border: "border-rose-300/45 shadow-[0_0_40px_-28px_rgba(244,63,94,0.95)]",
      badge: "bg-rose-300/15 text-rose-100 border-rose-300/45",
      label: "Needs attention",
    };
  }
  return {
    border: "border-amber-300/45 shadow-[0_0_40px_-30px_rgba(245,158,11,0.95)]",
    badge: "bg-amber-300/15 text-amber-100 border-amber-300/45",
    label: "Warning",
  };
}

export function SiteCard({ site }: Props) {
  const tone = stateTone(site);

  return (
    <li className={`rounded-3xl border bg-white/10 p-5 backdrop-blur-xl transition ${tone.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold text-white">{site.name}</p>
          <p className="mt-1 truncate text-sm text-brand-muted">{site.domain}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone.badge}`}>{tone.label}</span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/30 bg-white/90 p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Health score</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {site.healthScore !== null ? `${site.healthScore}%` : "No data available yet"}
          </p>
          <p className="mt-1 text-xs text-slate-600">{healthDelta(site.healthDelta)}</p>
        </div>
        <div className="rounded-2xl border border-white/30 bg-white/90 p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Issues</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {site.issuesCurrent !== null ? site.issuesCurrent : "No data available yet"}
          </p>
          <p className="mt-1 text-xs text-slate-600">{metricDelta(site.issuesDelta)}</p>
        </div>
        <div className="rounded-2xl border border-white/30 bg-white/90 p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Healthy pages</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {site.healthyPages !== null ? site.healthyPages : "No data available yet"}
          </p>
          <p className="mt-1 text-xs text-slate-600">From latest crawl report</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/25 bg-white/10 p-3">
        <p className="text-xs uppercase tracking-[0.12em] text-white/60">Top issue</p>
        <p className="mt-1 text-sm text-white">{site.topIssue ?? "No data available yet"}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-white/70">
        <p>Last checked: {formatRelative(site.lastCheckedAt)}</p>
        <p>Last activity: {formatRelative(site.lastSeenAt)}</p>
        <p>
          Visits (24h):{" "}
          {site.visits24h !== null ? site.visits24h.toLocaleString("en-US") : "No data available yet"}
        </p>
        <p>
          Pageviews (24h):{" "}
          {site.pageviews24h !== null ? site.pageviews24h.toLocaleString("en-US") : "No data available yet"}
        </p>
        <p>
          Visits (30d):{" "}
          {site.visits30d !== null ? site.visits30d.toLocaleString("en-US") : "No data available yet"}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link
          href={`/dashboard/sites/${site.id}`}
          className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-black transition hover:bg-brand-muted"
        >
          View report
        </Link>
        <Link
          href={`/dashboard/sites/${site.id}#seo-console`}
          className="rounded-full border border-white/35 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
        >
          Run scan
        </Link>
        <DeleteSiteButton siteId={site.id} siteName={site.name} compact />
      </div>
    </li>
  );
}
