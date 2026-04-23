import type { ParsedResponseCodes } from "./parser";

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
    critical: ParsedResponseCodes["issues"];
    warning: ParsedResponseCodes["issues"];
  };
  topIssues: TopIssue[];
  recommendations: Recommendation[];
};

function clampScore(score: number): number {
  if (score < 0) return 0;
  if (score > 100) return 100;
  return score;
}

function calculateHealthScore(summary: ParsedResponseCodes["summary"]): number {
  if (summary.totalUrls === 0) return 0;
  const penalty = summary.serverErrors * 10 + summary.clientErrors * 5 + summary.redirects * 2;
  return clampScore(100 - penalty);
}

function priorityBucket(issue: ParsedResponseCodes["issues"][number]): "critical" | "warning" | null {
  if (issue.category === "server_error" || issue.category === "broken_page") return "critical";
  if (issue.category === "redirect") return "warning";
  return null;
}

function categoryRank(issue: ParsedResponseCodes["issues"][number]): number {
  if (issue.category === "server_error") return 0;
  if (issue.category === "broken_page") return 1;
  if (issue.category === "redirect") return 2;
  return 99;
}

function sortCriticalIssues(
  issues: ParsedResponseCodes["issues"],
): ParsedResponseCodes["issues"] {
  return [...issues].sort((a, b) => {
    const rankDiff = categoryRank(a) - categoryRank(b);
    if (rankDiff !== 0) return rankDiff;
    return b.statusCode - a.statusCode;
  });
}

function buildTopIssues(issues: ParsedResponseCodes["issues"]): TopIssue[] {
  const issueCounts = new Map<string, number>();
  for (const issue of issues) {
    const key = `${issue.category}|${issue.url}|${issue.statusCode}`;
    issueCounts.set(key, (issueCounts.get(key) ?? 0) + 1);
  }

  const ranked = issues
    .map((issue, index) => ({ issue, index }))
    .sort((a, b) => {
      const rankDiff = categoryRank(a.issue) - categoryRank(b.issue);
      if (rankDiff !== 0) return rankDiff;
      const aKey = `${a.issue.category}|${a.issue.url}|${a.issue.statusCode}`;
      const bKey = `${b.issue.category}|${b.issue.url}|${b.issue.statusCode}`;
      const freqDiff = (issueCounts.get(bKey) ?? 0) - (issueCounts.get(aKey) ?? 0);
      if (freqDiff !== 0) return freqDiff;
      const statusDiff = b.issue.statusCode - a.issue.statusCode;
      if (statusDiff !== 0) return statusDiff;
      return a.index - b.index;
    })
    .slice(0, 5);

  return ranked.map(({ issue }) => ({
    url: issue.url,
    statusCode: issue.statusCode,
    issueTitle: issue.issueTitle,
    severity: issue.severity,
  }));
}

function buildRecommendations(summary: ParsedResponseCodes["summary"]): Recommendation[] {
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
  return recommendations;
}

export function buildResponseCodeInsights(parsed: ParsedResponseCodes): ResponseCodeInsights {
  const grouped = {
    critical: [] as ParsedResponseCodes["issues"],
    warning: [] as ParsedResponseCodes["issues"],
  };

  for (const issue of parsed.issues) {
    const bucket = priorityBucket(issue);
    if (!bucket) continue;
    grouped[bucket].push(issue);
  }

  return {
    overview: {
      totalUrls: parsed.summary.totalUrls,
      issuesFound: parsed.issues.length,
      criticalCount: parsed.severity.critical,
      warningCount: parsed.severity.warning,
      healthScore: calculateHealthScore(parsed.summary),
    },
    priorityGroups: {
      critical: sortCriticalIssues(grouped.critical),
      warning: grouped.warning,
    },
    topIssues: buildTopIssues(parsed.issues),
    recommendations: buildRecommendations(parsed.summary),
  };
}
