type ResponseCodeSummary = {
  totalUrls: number;
  healthy: number;
  redirects: number;
  clientErrors: number;
  serverErrors: number;
  other: number;
};

type ResponseCodeSeverity = {
  critical: number;
  warning: number;
  healthy: number;
  info: number;
};

type ResponseCodeIssue = {
  url?: unknown;
  statusCode?: unknown;
  issueTitle?: unknown;
  severity?: unknown;
  category?: unknown;
  [key: string]: unknown;
};

export type ResponseCodeParseResult = {
  source?: unknown;
  summary?: Partial<ResponseCodeSummary> | null;
  severity?: Partial<ResponseCodeSeverity> | null;
  rows?: unknown[] | null;
  issues?: ResponseCodeIssue[] | null;
  errors?: unknown[] | null;
};

type TopIssue = {
  url: string;
  statusCode: number;
  issueTitle: string;
  severity: string;
};

type Recommendation = {
  type: "fix_server_errors" | "fix_broken_pages" | "optimize_redirects";
  message: string;
  priority: "high" | "medium";
};

export type ResponseCodeInsights = {
  overview: {
    totalUrls: number;
    issuesFound: number;
    criticalCount: number;
    warningCount: number;
    healthScore: number;
  };
  priorityGroups: {
    critical: ResponseCodeIssue[];
    warning: ResponseCodeIssue[];
  };
  topIssues: TopIssue[];
  recommendations: Recommendation[];
};

function emptyInsights(): ResponseCodeInsights {
  return {
    overview: {
      totalUrls: 0,
      issuesFound: 0,
      criticalCount: 0,
      warningCount: 0,
      healthScore: 0,
    },
    priorityGroups: {
      critical: [],
      warning: [],
    },
    topIssues: [],
    recommendations: [],
  };
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function clampScore(score: number): number {
  if (score < 0) return 0;
  if (score > 100) return 100;
  return score;
}

function calculateHealthScore(summary: ResponseCodeSummary): number {
  if (summary.totalUrls === 0) return 0;
  const penalty =
    summary.serverErrors * 10 + summary.clientErrors * 5 + summary.redirects * 2;
  return clampScore(100 - penalty);
}

function safeSummary(input: ResponseCodeParseResult): ResponseCodeSummary {
  const summary = input.summary ?? {};
  return {
    totalUrls: toNumber(summary.totalUrls),
    healthy: toNumber(summary.healthy),
    redirects: toNumber(summary.redirects),
    clientErrors: toNumber(summary.clientErrors),
    serverErrors: toNumber(summary.serverErrors),
    other: toNumber(summary.other),
  };
}

function safeSeverity(input: ResponseCodeParseResult): ResponseCodeSeverity {
  const severity = input.severity ?? {};
  return {
    critical: toNumber(severity.critical),
    warning: toNumber(severity.warning),
    healthy: toNumber(severity.healthy),
    info: toNumber(severity.info),
  };
}

function safeIssues(input: ResponseCodeParseResult): ResponseCodeIssue[] {
  return Array.isArray(input.issues) ? [...input.issues] : [];
}

function priorityBucket(issue: ResponseCodeIssue): "critical" | "warning" | null {
  const category = toString(issue.category).toLowerCase();
  if (category === "server_error" || category === "broken_page") return "critical";
  if (category === "redirect") return "warning";
  return null;
}

function categoryRank(issue: ResponseCodeIssue): number {
  const category = toString(issue.category).toLowerCase();
  if (category === "server_error") return 0;
  if (category === "broken_page") return 1;
  if (category === "redirect") return 2;
  return 99;
}

function sortCriticalIssues(issues: ResponseCodeIssue[]): ResponseCodeIssue[] {
  return [...issues].sort((a, b) => {
    const rankDiff = categoryRank(a) - categoryRank(b);
    if (rankDiff !== 0) return rankDiff;
    return toNumber(b.statusCode, -1) - toNumber(a.statusCode, -1);
  });
}

function buildTopIssues(issues: ResponseCodeIssue[]): TopIssue[] {
  const issueCounts = new Map<string, number>();
  for (const issue of issues) {
    const key = `${toString(issue.category)}|${toString(issue.url)}|${toNumber(issue.statusCode, -1)}`;
    issueCounts.set(key, (issueCounts.get(key) ?? 0) + 1);
  }

  const ranked = issues
    .map((issue, index) => ({ issue, index }))
    .sort((a, b) => {
      const rankDiff = categoryRank(a.issue) - categoryRank(b.issue);
      if (rankDiff !== 0) return rankDiff;

      const aKey = `${toString(a.issue.category)}|${toString(a.issue.url)}|${toNumber(a.issue.statusCode, -1)}`;
      const bKey = `${toString(b.issue.category)}|${toString(b.issue.url)}|${toNumber(b.issue.statusCode, -1)}`;
      const freqDiff = (issueCounts.get(bKey) ?? 0) - (issueCounts.get(aKey) ?? 0);
      if (freqDiff !== 0) return freqDiff;

      const statusCodeDiff =
        toNumber(b.issue.statusCode, -1) - toNumber(a.issue.statusCode, -1);
      if (statusCodeDiff !== 0) return statusCodeDiff;

      return a.index - b.index;
    })
    .slice(0, 5);

  return ranked.map(({ issue }) => ({
    url: toString(issue.url),
    statusCode: toNumber(issue.statusCode),
    issueTitle: toString(issue.issueTitle),
    severity: toString(issue.severity),
  }));
}

function buildRecommendations(summary: ResponseCodeSummary): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (summary.serverErrors > 0) {
    recommendations.push({
      type: "fix_server_errors",
      message: "Resolve server-side errors to ensure pages return valid responses.",
      priority: "high",
    });
  }

  if (summary.clientErrors > 0) {
    recommendations.push({
      type: "fix_broken_pages",
      message: "Fix or remove links to pages returning 4xx errors.",
      priority: "high",
    });
  }

  if (summary.redirects > 0) {
    recommendations.push({
      type: "optimize_redirects",
      message: "Reduce unnecessary redirects and link directly to final URLs.",
      priority: "medium",
    });
  }

  const seen = new Set<Recommendation["type"]>();
  return recommendations.filter((item) => {
    if (seen.has(item.type)) return false;
    seen.add(item.type);
    return true;
  });
}

export function buildResponseCodeInsights(
  result: ResponseCodeParseResult | null | undefined,
): ResponseCodeInsights {
  if (!result || typeof result !== "object") {
    return emptyInsights();
  }

  const summary = safeSummary(result);
  const severity = safeSeverity(result);
  const issues = safeIssues(result);
  const grouped = {
    critical: [] as ResponseCodeIssue[],
    warning: [] as ResponseCodeIssue[],
  };

  for (const issue of issues) {
    const bucket = priorityBucket(issue);
    if (!bucket) continue;
    grouped[bucket].push(issue);
  }

  return {
    overview: {
      totalUrls: summary.totalUrls,
      issuesFound: issues.length,
      criticalCount: severity.critical,
      warningCount: severity.warning,
      healthScore: calculateHealthScore(summary),
    },
    priorityGroups: {
      critical: sortCriticalIssues(grouped.critical),
      warning: grouped.warning,
    },
    topIssues: buildTopIssues(issues),
    recommendations: buildRecommendations(summary),
  };
}

/**
 * Usage:
 * const insights = buildResponseCodeInsights(parseResult);
 */
