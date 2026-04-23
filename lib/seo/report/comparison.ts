import type { ResponseCodeReport } from "@/lib/seo/response-codes";
import { getSeoPlaybookResponse } from "@/lib/seo/playbook/responses";

type Trend = "better" | "worse" | "stable" | "n/a";
type Priority = "high" | "medium" | "low";

type StatusBuckets = {
  healthy2xx: number;
  redirects3xx: number;
  clientErrors4xx: number;
  serverErrors5xx: number;
  unknown: number;
};

type MetricDelta = {
  key: string;
  label: string;
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number | null;
  trend: Trend;
};

type ComparisonInsight = {
  id: string;
  title: string;
  summary: string;
  severity: "critical" | "warning" | "info";
  trend: Exclude<Trend, "n/a">;
};

type RecommendationChange = {
  added: string[];
  removed: string[];
};

export type ComparisonActionItem = {
  id: string;
  priority: Priority;
  title: string;
  affectedCount: number;
  whyItMatters: string;
  howToFix: string[];
  goodLooksLike: string;
};

export type ResponseCodeComparison = {
  hasPrevious: boolean;
  overview: {
    headline: string;
    summary: string;
    currentCrawlDate: string | null;
    previousCrawlDate: string | null;
  };
  deltas: {
    totalPages: MetricDelta;
    statusBuckets: StatusBuckets & {
      previous: StatusBuckets;
      delta: StatusBuckets;
    };
    issuesFound: MetricDelta;
    healthScore: MetricDelta;
    newIssues: number;
    resolvedIssues: number;
  };
  regressions: ComparisonInsight[];
  improvements: ComparisonInsight[];
  unchanged: string[];
  recommendationChanges: RecommendationChange;
  actionItems: ComparisonActionItem[];
};

type BuildComparisonInput = {
  current: ResponseCodeReport;
  previous: ResponseCodeReport | null;
  currentCreatedAt?: string | null;
  previousCreatedAt?: string | null;
};

function toBuckets(report: ResponseCodeReport): StatusBuckets {
  const s = report.raw.summary;
  return {
    healthy2xx: s.healthy,
    redirects3xx: s.redirects,
    clientErrors4xx: s.clientErrors,
    serverErrors5xx: s.serverErrors,
    unknown: s.other,
  };
}

function toMetricDelta(
  key: string,
  label: string,
  current: number,
  previous: number,
  higherIsBetter: boolean,
): MetricDelta {
  const delta = current - previous;
  const deltaPercent = previous === 0 ? null : Number(((delta / previous) * 100).toFixed(1));
  let trend: Trend = "stable";
  if (delta !== 0) {
    if (higherIsBetter) trend = delta > 0 ? "better" : "worse";
    else trend = delta < 0 ? "better" : "worse";
  }
  return { key, label, current, previous, delta, deltaPercent, trend };
}

function issueKeys(report: ResponseCodeReport): Set<string> {
  const keys = new Set<string>();
  for (const row of report.raw.rows) {
    if (row.statusCode >= 200 && row.statusCode <= 299) continue;
    keys.add(`${row.url}|${row.statusCode}`);
  }
  return keys;
}

function deltaWord(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function recommendationDiff(current: ResponseCodeReport, previous: ResponseCodeReport): RecommendationChange {
  const currentSet = new Set(current.insights.recommendations.map((r) => r.type));
  const previousSet = new Set(previous.insights.recommendations.map((r) => r.type));

  const added = [...currentSet].filter((x) => !previousSet.has(x));
  const removed = [...previousSet].filter((x) => !currentSet.has(x));
  return { added, removed };
}

function buildNoPrevious(current: ResponseCodeReport, currentCreatedAt: string | null): ResponseCodeComparison {
  const buckets = toBuckets(current);
  return {
    hasPrevious: false,
    overview: {
      headline: "First crawl in. Comparison unlocks on the next run.",
      summary:
        "You have a solid baseline now. Run one more crawl and we will highlight what got better, what slipped, and what to fix first.",
      currentCrawlDate: currentCreatedAt,
      previousCrawlDate: null,
    },
    deltas: {
      totalPages: toMetricDelta(
        "totalPages",
        "Pages crawled",
        current.insights.overview.totalUrls,
        0,
        true,
      ),
      statusBuckets: {
        ...buckets,
        previous: { healthy2xx: 0, redirects3xx: 0, clientErrors4xx: 0, serverErrors5xx: 0, unknown: 0 },
        delta: buckets,
      },
      issuesFound: toMetricDelta(
        "issuesFound",
        "Issues found",
        current.insights.overview.issuesFound,
        0,
        false,
      ),
      healthScore: toMetricDelta(
        "healthScore",
        "Health score",
        current.insights.overview.healthScore,
        0,
        true,
      ),
      newIssues: current.raw.issues.length,
      resolvedIssues: 0,
    },
    regressions: [],
    improvements: [],
    unchanged: [],
    recommendationChanges: { added: [], removed: [] },
    actionItems: [],
  };
}

export function buildResponseCodeComparison({
  current,
  previous,
  currentCreatedAt = null,
  previousCreatedAt = null,
}: BuildComparisonInput): ResponseCodeComparison {
  if (!previous) {
    return buildNoPrevious(current, currentCreatedAt);
  }

  const currentBuckets = toBuckets(current);
  const previousBuckets = toBuckets(previous);
  const deltaBuckets: StatusBuckets = {
    healthy2xx: currentBuckets.healthy2xx - previousBuckets.healthy2xx,
    redirects3xx: currentBuckets.redirects3xx - previousBuckets.redirects3xx,
    clientErrors4xx: currentBuckets.clientErrors4xx - previousBuckets.clientErrors4xx,
    serverErrors5xx: currentBuckets.serverErrors5xx - previousBuckets.serverErrors5xx,
    unknown: currentBuckets.unknown - previousBuckets.unknown,
  };

  const currentIssueSet = issueKeys(current);
  const previousIssueSet = issueKeys(previous);
  let newIssues = 0;
  let resolvedIssues = 0;
  for (const issue of currentIssueSet) if (!previousIssueSet.has(issue)) newIssues += 1;
  for (const issue of previousIssueSet) if (!currentIssueSet.has(issue)) resolvedIssues += 1;

  const regressions: ComparisonInsight[] = [];
  const improvements: ComparisonInsight[] = [];
  const unchanged: string[] = [];

  if (deltaBuckets.serverErrors5xx > 0) {
    regressions.push({
      id: "server-errors-up",
      title: "Server errors increased",
      summary: `${currentBuckets.serverErrors5xx} pages now return 5xx (${deltaWord(
        deltaBuckets.serverErrors5xx,
      )} vs previous crawl).`,
      severity: "critical",
      trend: "worse",
    });
  } else if (deltaBuckets.serverErrors5xx < 0) {
    improvements.push({
      id: "server-errors-down",
      title: "Server errors dropped",
      summary: `5xx pages fell to ${currentBuckets.serverErrors5xx} (${deltaWord(
        deltaBuckets.serverErrors5xx,
      )} vs previous crawl).`,
      severity: "info",
      trend: "better",
    });
  } else {
    unchanged.push("Server error count stayed flat.");
  }

  if (deltaBuckets.clientErrors4xx > 0) {
    regressions.push({
      id: "client-errors-up",
      title: "More broken pages (4xx)",
      summary: `${currentBuckets.clientErrors4xx} pages return 4xx (${deltaWord(
        deltaBuckets.clientErrors4xx,
      )} from last crawl).`,
      severity: "warning",
      trend: "worse",
    });
  } else if (deltaBuckets.clientErrors4xx < 0) {
    improvements.push({
      id: "client-errors-down",
      title: "Fewer broken pages (4xx)",
      summary: `4xx pages dropped to ${currentBuckets.clientErrors4xx} (${deltaWord(
        deltaBuckets.clientErrors4xx,
      )} from last crawl).`,
      severity: "info",
      trend: "better",
    });
  } else {
    unchanged.push("Broken-page count (4xx) is unchanged.");
  }

  if (deltaBuckets.healthy2xx < 0) {
    regressions.push({
      id: "healthy-pages-down",
      title: "Healthy pages decreased",
      summary: `Healthy 2xx pages moved from ${previousBuckets.healthy2xx} to ${currentBuckets.healthy2xx}.`,
      severity: "warning",
      trend: "worse",
    });
  } else if (deltaBuckets.healthy2xx > 0) {
    improvements.push({
      id: "healthy-pages-up",
      title: "Healthy pages increased",
      summary: `Healthy 2xx pages moved from ${previousBuckets.healthy2xx} to ${currentBuckets.healthy2xx}.`,
      severity: "info",
      trend: "better",
    });
  } else {
    unchanged.push("Healthy-page count is stable.");
  }

  if (newIssues > 0) {
    regressions.push({
      id: "new-issues",
      title: "New issues were introduced",
      summary: `${newIssues} URL/status combinations are newly problematic since the last crawl.`,
      severity: "warning",
      trend: "worse",
    });
  }
  if (resolvedIssues > 0) {
    improvements.push({
      id: "resolved-issues",
      title: "Issues were resolved",
      summary: `${resolvedIssues} previously problematic URL/status combinations no longer show up.`,
      severity: "info",
      trend: "better",
    });
  }

  const actionItems: ComparisonActionItem[] = [];
  if (currentBuckets.serverErrors5xx > 0) {
    const playbook = getSeoPlaybookResponse("5xx");
    actionItems.push({
      id: "fix-5xx",
      priority: "high",
      title: playbook.title,
      affectedCount: currentBuckets.serverErrors5xx,
      whyItMatters: playbook.whyItMatters,
      howToFix: playbook.actionableFixSteps,
      goodLooksLike: "Critical templates return stable 2xx responses across repeated crawls.",
    });
  }
  if (currentBuckets.clientErrors4xx > 0) {
    const playbook = getSeoPlaybookResponse("404");
    actionItems.push({
      id: "fix-4xx",
      priority: "high",
      title: playbook.title,
      affectedCount: currentBuckets.clientErrors4xx,
      whyItMatters: playbook.whyItMatters,
      howToFix: playbook.actionableFixSteps,
      goodLooksLike: "Internal links resolve directly to 200 pages without dead ends.",
    });
  }
  if (currentBuckets.redirects3xx > 0) {
    const playbook = getSeoPlaybookResponse("redirects");
    actionItems.push({
      id: "trim-redirects",
      priority: "medium",
      title: playbook.title,
      affectedCount: currentBuckets.redirects3xx,
      whyItMatters: playbook.whyItMatters,
      howToFix: playbook.actionableFixSteps,
      goodLooksLike: "Most internal crawl hits are direct 200 responses.",
    });
  }
  if (currentBuckets.unknown > 0) {
    const playbook = getSeoPlaybookResponse("unknown_crawl_issues");
    actionItems.push({
      id: "investigate-unknown",
      priority: "medium",
      title: playbook.title,
      affectedCount: currentBuckets.unknown,
      whyItMatters: playbook.whyItMatters,
      howToFix: playbook.actionableFixSteps,
      goodLooksLike: "Unknown bucket stays near zero and response classes are explicit.",
    });
  }

  const recChanges = recommendationDiff(current, previous);

  return {
    hasPrevious: true,
    overview: {
      headline:
        regressions.length > 0
          ? "A few pages wandered off the happy path."
          : improvements.length > 0
            ? "No drama. This crawl moved in the right direction."
            : "Steady state. No major movement since last crawl.",
      summary:
        regressions.length > 0
          ? `${regressions.length} regression signal(s), ${improvements.length} improvement signal(s).`
          : `No major regressions detected. ${improvements.length} area(s) improved.`,
      currentCrawlDate: currentCreatedAt,
      previousCrawlDate: previousCreatedAt,
    },
    deltas: {
      totalPages: toMetricDelta(
        "totalPages",
        "Pages crawled",
        current.insights.overview.totalUrls,
        previous.insights.overview.totalUrls,
        true,
      ),
      statusBuckets: {
        ...currentBuckets,
        previous: previousBuckets,
        delta: deltaBuckets,
      },
      issuesFound: toMetricDelta(
        "issuesFound",
        "Issues found",
        current.insights.overview.issuesFound,
        previous.insights.overview.issuesFound,
        false,
      ),
      healthScore: toMetricDelta(
        "healthScore",
        "Health score",
        current.insights.overview.healthScore,
        previous.insights.overview.healthScore,
        true,
      ),
      newIssues,
      resolvedIssues,
    },
    regressions,
    improvements,
    unchanged,
    recommendationChanges: recChanges,
    actionItems,
  };
}
