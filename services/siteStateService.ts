import {
  getLatestScansByType,
  recordCompletedScan,
  type AnalyticsScanSummary,
  type CompletedScan,
  type ScanLifecycleRecord,
  type ReputationScanSummary,
  type ScanType,
  type SeoScanSummary,
  type UptimeScanSummary,
} from "@/lib/db/scans";
import type { SiteAnalytics } from "@/lib/db/analytics";
import type { SeoCrawlRunRow } from "@/lib/db/seo-crawl-intelligence";
import type { WebsiteUptimeSnapshot } from "@/lib/db/uptime";
import type { RecentSocialMention } from "@/lib/social/socialMentionService";

type SiteStateEntry<T extends ScanType> = {
  scanType: T;
  startedAt: string | null;
  completedAt: string | null;
  summary: CompletedScan<T>["result_summary"] | null;
  source: string | null;
  status: "ready" | "missing" | "running" | "failed";
  errorMessage: string | null;
};

export type SiteIntelligenceState = {
  seo: SiteStateEntry<"seo">;
  uptime: SiteStateEntry<"uptime">;
  analytics: SiteStateEntry<"analytics">;
  reputation: SiteStateEntry<"reputation">;
};

function numberFrom(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSeoSummary(value: unknown): SeoScanSummary {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    broken_pages: numberFrom(raw.broken_pages),
    missing_meta: numberFrom(raw.missing_meta),
    performance_issues: numberFrom(raw.performance_issues),
  };
}

function normalizeUptimeSummary(value: unknown): UptimeScanSummary {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    status: raw.status === "offline" ? "offline" : "online",
    downtime_events: numberFrom(raw.downtime_events),
  };
}

function normalizeAnalyticsSummary(value: unknown): AnalyticsScanSummary {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const trend = raw.trend === "up" || raw.trend === "down" || raw.trend === "flat" ? raw.trend : "flat";
  return {
    traffic_24h: numberFrom(raw.traffic_24h),
    trend,
  };
}

function normalizeReputationSummary(value: unknown): ReputationScanSummary {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    mentions: numberFrom(raw.mentions),
    flagged_mentions: numberFrom(raw.flagged_mentions),
  };
}

function entry<T extends ScanType>(
  scanType: T,
  scan: ScanLifecycleRecord<T> | undefined,
  normalize: (value: unknown) => CompletedScan<T>["result_summary"],
): SiteStateEntry<T> {
  if (!scan) {
    return {
      scanType,
      startedAt: null,
      completedAt: null,
      summary: null,
      source: null,
      status: "missing",
      errorMessage: null,
    };
  }

  const isComplete = scan.status === "complete" && scan.completed_at && scan.result_summary;
  return {
    scanType,
    startedAt: scan.started_at,
    completedAt: scan.completed_at,
    summary: isComplete ? normalize(scan.result_summary) : null,
    source: scan.source,
    status: scan.status === "complete" ? "ready" : scan.status,
    errorMessage: scan.error_message,
  };
}

export async function getSiteIntelligenceState(siteId: string): Promise<SiteIntelligenceState> {
  const scans = await getLatestScansByType(siteId);
  return {
    seo: entry("seo", scans.seo, normalizeSeoSummary),
    uptime: entry("uptime", scans.uptime, normalizeUptimeSummary),
    analytics: entry("analytics", scans.analytics, normalizeAnalyticsSummary),
    reputation: entry("reputation", scans.reputation, normalizeReputationSummary),
  };
}

export function buildSeoScanSummary(crawl: SeoCrawlRunRow): SeoScanSummary {
  return {
    broken_pages: crawl.critical_count,
    missing_meta: crawl.warning_count,
    performance_issues: crawl.notice_count,
  };
}

export function buildUptimeScanSummary(snapshot: WebsiteUptimeSnapshot): UptimeScanSummary | null {
  if (!snapshot.lastCheckedAt || snapshot.status === "unknown") return null;
  return {
    status: snapshot.status === "down" ? "offline" : "online",
    downtime_events: Math.max(0, snapshot.checks24h - snapshot.checksUp24h),
  };
}

export function buildAnalyticsScanSummary(analytics: SiteAnalytics): AnalyticsScanSummary {
  const recent = analytics.timeline.at(-1)?.sessions ?? analytics.overview.sessions24h;
  const previous = analytics.timeline.at(-2)?.sessions ?? recent;
  return {
    traffic_24h: analytics.overview.sessions24h,
    trend: recent > previous ? "up" : recent < previous ? "down" : "flat",
  };
}

export function buildReputationScanSummary(mentions: RecentSocialMention[]): ReputationScanSummary {
  return {
    mentions: mentions.length,
    flagged_mentions: mentions.filter((mention) => mention.urgency === "high" || mention.impact_score >= 60).length,
  };
}

export async function syncSiteStateFromCurrentData(input: {
  siteId: string;
  analytics: SiteAnalytics;
  uptimeSnapshot: WebsiteUptimeSnapshot | null;
  latestCrawl: SeoCrawlRunRow | null;
  socialMentions: RecentSocialMention[];
}): Promise<SiteIntelligenceState> {
  const writes: Promise<void>[] = [
    recordCompletedScan({
      siteId: input.siteId,
      scanType: "analytics",
      completedAt: new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000),
      resultSummary: buildAnalyticsScanSummary(input.analytics),
      source: "dashboard-refresh",
    }),
  ];

  if (input.latestCrawl) {
    writes.push(
      recordCompletedScan({
        siteId: input.siteId,
        scanType: "seo",
        completedAt: input.latestCrawl.created_at,
        resultSummary: buildSeoScanSummary(input.latestCrawl),
        source: `seo-crawl:${input.latestCrawl.id}`,
        rawResult: { crawlRunId: input.latestCrawl.id },
      }),
    );
  }

  const uptimeSummary = input.uptimeSnapshot ? buildUptimeScanSummary(input.uptimeSnapshot) : null;
  if (input.uptimeSnapshot?.lastCheckedAt && uptimeSummary) {
    writes.push(
      recordCompletedScan({
        siteId: input.siteId,
        scanType: "uptime",
        completedAt: input.uptimeSnapshot.lastCheckedAt,
        resultSummary: uptimeSummary,
        source: "uptime-check",
      }),
    );
  }

  if (input.socialMentions.length > 0) {
    writes.push(
      recordCompletedScan({
        siteId: input.siteId,
        scanType: "reputation",
        completedAt: input.socialMentions[0]?.discovered_at ?? new Date(),
        resultSummary: buildReputationScanSummary(input.socialMentions),
        source: "reputation-pulse",
      }),
    );
  }

  await Promise.all(
    writes.map((write) =>
      write.catch((err) => {
        console.error("[site-state] failed to sync scan summary", { siteId: input.siteId, err });
      }),
    ),
  );

  return getSiteIntelligenceState(input.siteId);
}
