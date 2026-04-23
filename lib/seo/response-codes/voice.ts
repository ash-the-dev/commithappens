import type { ResponseCodeInsights } from "./insights";

type VoiceStatusLabel = "healthy" | "warning" | "critical" | "empty";

export type ResponseCodeVoice = {
  headline: string;
  subheadline: string;
  summary: string;
  statusLabel: VoiceStatusLabel;
  issueHighlights: string[];
  recommendationMessages: string[];
  emptyStateMessage: string;
};

function truncateUrl(url: string, max = 60): string {
  if (!url) return "unknown URL";
  if (url.length <= max) return url;
  return `${url.slice(0, max - 3)}...`;
}

function getStatusLabel(input: ResponseCodeInsights): VoiceStatusLabel {
  const totalUrls = input.overview.totalUrls;
  const criticalCount = input.overview.criticalCount;
  const warningCount = input.overview.warningCount;
  if (totalUrls === 0) return "empty";
  if (criticalCount > 0) return "critical";
  if (warningCount > 0) return "warning";
  return "healthy";
}

function headlineForStatus(status: VoiceStatusLabel): string {
  if (status === "empty") return "No crawl data yet.";
  if (status === "healthy") return "Nothing appears to be exploding.";
  if (status === "warning") return "A few things are wobbling.";
  return "Well, that got ugly fast.";
}

function subheadlineForStatus(status: VoiceStatusLabel): string {
  if (status === "empty") return "Run a crawl first so we have something to judge.";
  if (status === "healthy") return "Most URLs are behaving themselves.";
  if (status === "warning") {
    return "You have redirects worth cleaning up before they turn into a bigger mess.";
  }
  return "Some pages are broken or throwing server errors, and those need attention first.";
}

function buildSummary(input: ResponseCodeInsights, status: VoiceStatusLabel): string {
  const { totalUrls, issuesFound, criticalCount, healthScore } = input.overview;
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

function buildIssueHighlights(input: ResponseCodeInsights): string[] {
  return input.topIssues.slice(0, 3).map((issue) => {
    const url = truncateUrl(issue.url);
    const statusCode = issue.statusCode;
    if (statusCode >= 500 && statusCode <= 599) {
      return `${statusCode} on ${url}. The server had a moment.`;
    }
    if (statusCode >= 400 && statusCode <= 499) {
      return `${statusCode} on ${url}. That page is missing, and your links did not get the memo.`;
    }
    if (statusCode >= 300 && statusCode <= 399) {
      return `${statusCode} on ${url}. It works, but it is taking the scenic route.`;
    }
    return `${issue.issueTitle} on ${url}. Worth a quick look.`;
  });
}

function recommendationMessageByType(type: string, fallbackMessage: string): string {
  if (type === "fix_server_errors") {
    return "Fix the server errors first. A 500 means the page did not just fail, it faceplanted.";
  }
  if (type === "fix_broken_pages") {
    return "Clean up the broken pages next. If a URL returns 404, visitors and search engines both hit a wall.";
  }
  if (type === "optimize_redirects") {
    return "Then trim the redirects. They still work, but they are taking the long way around.";
  }
  return fallbackMessage || "Tidy up this issue group before it snowballs.";
}

function buildRecommendationMessages(input: ResponseCodeInsights): string[] {
  const seen = new Set<string>();
  const messages: string[] = [];
  for (const rec of input.recommendations) {
    const key = rec.type || rec.message;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    messages.push(recommendationMessageByType(rec.type, rec.message));
  }
  return messages;
}

export function buildResponseCodeVoice(insights: ResponseCodeInsights): ResponseCodeVoice {
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
