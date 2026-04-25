type VoiceStatusLabel = "healthy" | "warning" | "critical" | "empty";

type ResponseCodeInsightsInput = {
  overview?: {
    totalUrls?: unknown;
    issuesFound?: unknown;
    criticalCount?: unknown;
    warningCount?: unknown;
    healthScore?: unknown;
  } | null;
  priorityGroups?: {
    critical?: unknown[];
    warning?: unknown[];
  } | null;
  topIssues?: Array<{
    url?: unknown;
    statusCode?: unknown;
    issueTitle?: unknown;
    severity?: unknown;
  }> | null;
  recommendations?: Array<{
    type?: unknown;
    message?: unknown;
    priority?: unknown;
  }> | null;
};

export type ResponseCodeVoice = {
  headline: string;
  subheadline: string;
  summary: string;
  statusLabel: VoiceStatusLabel;
  issueHighlights: string[];
  recommendationMessages: string[];
  emptyStateMessage: string;
};

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function truncateUrl(url: string, max = 60): string {
  if (!url) return "unknown URL";
  if (url.length <= max) return url;
  return `${url.slice(0, max - 3)}...`;
}

function getStatusLabel(input: ResponseCodeInsightsInput): VoiceStatusLabel {
  const overview = input.overview ?? {};
  const totalUrls = toNumber(overview.totalUrls);
  const criticalCount = toNumber(overview.criticalCount);
  const warningCount = toNumber(overview.warningCount);

  if (totalUrls === 0) return "empty";
  if (criticalCount > 0) return "critical";
  if (warningCount > 0) return "warning";
  return "healthy";
}

function headlineForStatus(status: VoiceStatusLabel): string {
  switch (status) {
    case "empty":
      return "No crawl data yet.";
    case "healthy":
      return "Nothing appears to be exploding.";
    case "warning":
      return "A few things are wobbling.";
    case "critical":
    default:
      return "Well, that got ugly fast.";
  }
}

function subheadlineForStatus(status: VoiceStatusLabel): string {
  switch (status) {
    case "empty":
      return "Run a crawl first so we have something to judge.";
    case "healthy":
      return "Most URLs are behaving themselves.";
    case "warning":
      return "You have redirects worth cleaning up before they turn into a bigger mess.";
    case "critical":
    default:
      return "Some pages are broken or throwing server errors, and those need attention first.";
  }
}

function buildSummary(input: ResponseCodeInsightsInput, status: VoiceStatusLabel): string {
  const overview = input.overview ?? {};
  const totalUrls = toNumber(overview.totalUrls);
  const issuesFound = toNumber(overview.issuesFound);
  const criticalCount = toNumber(overview.criticalCount);
  const healthScore = toNumber(overview.healthScore);

  if (status === "empty") {
    return "No crawl data yet, so there is nothing to analyze. Run a crawl and we will take it from there.";
  }

  if (status === "healthy") {
    return `We checked ${totalUrls} URLs. Nothing appears to be actively breaking, which is always a nice surprise. Health score: ${healthScore}.`;
  }

  if (status === "warning") {
    return `We scanned ${totalUrls} URLs and found ${issuesFound} warning-level issues. Nothing catastrophic, but there is cleanup to do. Health score: ${healthScore}.`;
  }

  return `We checked ${totalUrls} URLs and found ${issuesFound} issues, including ${criticalCount} critical ones. That is where the mess starts. Health score: ${healthScore}.`;
}

function buildIssueHighlight(
  issue: NonNullable<ResponseCodeInsightsInput["topIssues"]>[number],
): string {
  const url = truncateUrl(toString(issue.url));
  const statusCode = toNumber(issue.statusCode);

  if (statusCode >= 500 && statusCode <= 599) {
    return `${statusCode} on ${url}. The server had a moment.`;
  }
  if (statusCode >= 400 && statusCode <= 499) {
    return `${statusCode} on ${url}. That page is missing, and your links did not get the memo.`;
  }
  if (statusCode >= 300 && statusCode <= 399) {
    return `${statusCode} on ${url}. It works, but it is taking the scenic route.`;
  }

  const issueTitle = toString(issue.issueTitle, "Issue");
  return `${issueTitle} on ${url}. Worth a quick look.`;
}

function buildIssueHighlights(input: ResponseCodeInsightsInput): string[] {
  const topIssues = Array.isArray(input.topIssues) ? input.topIssues : [];
  return topIssues.slice(0, 3).map((issue) => buildIssueHighlight(issue));
}

function recommendationMessageByType(type: string, fallbackMessage: string): string {
  switch (type) {
    case "fix_server_errors":
      return "Fix the server errors first. A 500 means the page did not just fail, it faceplanted.";
    case "fix_broken_pages":
      return "Clean up the broken pages next. If a URL returns 404, visitors and search engines both hit a wall.";
    case "optimize_redirects":
      return "Then trim the redirects. They still work, but they are taking the long way around.";
    default:
      return fallbackMessage || "Tidy up this issue group before it snowballs.";
  }
}

function buildRecommendationMessages(input: ResponseCodeInsightsInput): string[] {
  const recommendations = Array.isArray(input.recommendations)
    ? input.recommendations
    : [];

  const seen = new Set<string>();
  const messages: string[] = [];
  for (const rec of recommendations) {
    const type = toString(rec.type);
    const key = type || toString(rec.message);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    messages.push(recommendationMessageByType(type, toString(rec.message)));
  }
  return messages;
}

function emptyVoiceObject(): ResponseCodeVoice {
  return {
    headline: "No crawl data yet.",
    subheadline: "Run a crawl first so we have something to judge.",
    summary: "No crawl data yet, so there is nothing to analyze. Run a crawl and we will take it from there.",
    statusLabel: "empty",
    issueHighlights: [],
    recommendationMessages: [],
    emptyStateMessage:
      "No crawl data yet. Run the crawler and we will see what your site is hiding.",
  };
}

export function buildResponseCodeVoice(
  insights: ResponseCodeInsightsInput | null | undefined,
): ResponseCodeVoice {
  if (!insights || typeof insights !== "object") {
    return emptyVoiceObject();
  }

  const status = getStatusLabel(insights);
  return {
    headline: headlineForStatus(status),
    subheadline: subheadlineForStatus(status),
    summary: buildSummary(insights, status),
    statusLabel: status,
    issueHighlights: buildIssueHighlights(insights),
    recommendationMessages: buildRecommendationMessages(insights),
    emptyStateMessage:
      status === "empty"
        ? "No crawl data yet. Run the crawler and we will see what your site is hiding."
        : "",
  };
}

/**
 * Usage:
 * const voice = buildResponseCodeVoice(insights);
 */
