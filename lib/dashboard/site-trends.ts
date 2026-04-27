import type { WebsiteUptimeHistoryItem } from "@/lib/db/uptime";
import type { SeoCrawlRunTrendPoint } from "@/lib/db/seo-crawl-intelligence";

export type SiteTrendsPayload = {
  generatedAt: string;
  /**
   * `live` = enough real points for a series; `partial` = one or more series are still empty.
   */
  source: "live" | "partial" | "demo";
  seoHealth: { at: string; label: string; score: number }[];
  issues: { at: string; label: string; count: number }[];
  uptime: { at: string; label: string; pct: number }[];
  responseMs: { at: string; label: string; ms: number | null }[];
};

function toShortLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toShortTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Newest first → ascending for charts */
function historyAsc(h: WebsiteUptimeHistoryItem[]): WebsiteUptimeHistoryItem[] {
  return [...h].sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime());
}

/**
 * Assembles time-series for the report dashboard from stored data only.
 */
export function buildSiteTrendsPayload(
  crawls: SeoCrawlRunTrendPoint[],
  uptimeLogs: WebsiteUptimeHistoryItem[],
): SiteTrendsPayload {
  const now = new Date().toISOString();
  const seoHealth = crawls.map((c) => ({
    at: c.created_at,
    label: toShortLabel(c.created_at),
    score: c.health_score,
  }));
  const issues = crawls.map((c) => ({
    at: c.created_at,
    label: toShortLabel(c.created_at),
    count: c.issues_total,
  }));

  const upAsc = historyAsc(uptimeLogs);
  const uptimePct = (u: WebsiteUptimeHistoryItem): number => {
    if (u.status === "up") return 100;
    return 0;
  };
  const uptime = upAsc.map((u) => ({
    at: u.checkedAt,
    label: toShortTimeLabel(u.checkedAt),
    pct: uptimePct(u),
  }));
  const responseMs = upAsc.map((u) => ({
    at: u.checkedAt,
    label: toShortTimeLabel(u.checkedAt),
    ms: u.responseTimeMs,
  }));

  const hasCrawl = seoHealth.length > 0;
  const hasUptime = uptime.length > 0;

  if (!hasCrawl && !hasUptime) {
    return { generatedAt: now, source: "partial", seoHealth: [], issues: [], uptime: [], responseMs: [] };
  }

  let source: SiteTrendsPayload["source"] = "live";
  if (!hasCrawl || !hasUptime) {
    source = "partial";
  }

  return {
    generatedAt: now,
    source,
    seoHealth,
    issues,
    uptime,
    responseMs,
  };
}
