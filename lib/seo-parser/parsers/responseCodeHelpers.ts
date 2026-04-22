export type ResponseCodeSeverity =
  | "critical"
  | "warning"
  | "healthy"
  | "info";

export type ResponseCodeCategory =
  | "server_error"
  | "broken_page"
  | "redirect"
  | "success"
  | "other";

export function mapStatusCodeToSeverity(statusCode: number): ResponseCodeSeverity {
  if (statusCode >= 500 && statusCode <= 599) return "critical";
  if (statusCode >= 400 && statusCode <= 499) return "critical";
  if (statusCode >= 300 && statusCode <= 399) return "warning";
  if (statusCode >= 200 && statusCode <= 299) return "healthy";
  return "info";
}

export function mapStatusCodeToCategory(statusCode: number): ResponseCodeCategory {
  if (statusCode >= 500 && statusCode <= 599) return "server_error";
  if (statusCode >= 400 && statusCode <= 499) return "broken_page";
  if (statusCode >= 300 && statusCode <= 399) return "redirect";
  if (statusCode >= 200 && statusCode <= 299) return "success";
  return "other";
}

export function issueTitleForCategory(category: ResponseCodeCategory): string {
  switch (category) {
    case "server_error":
      return "Server error page";
    case "broken_page":
      return "Broken page";
    case "redirect":
      return "Redirected URL";
    case "success":
      return "Healthy page";
    case "other":
    default:
      return "Unclassified response";
  }
}

export function issueDetails(
  statusCode: number,
  status: string,
  category: ResponseCodeCategory,
): string {
  const safeStatus = status || "Unknown";
  switch (category) {
    case "server_error":
      return `This URL returned a ${statusCode} ${safeStatus} response from the server.`;
    case "broken_page":
      return `This URL returned a ${statusCode} ${safeStatus} response.`;
    case "redirect":
      return `This URL returned a ${statusCode} ${safeStatus} redirect response.`;
    case "success":
      return `This URL returned a ${statusCode} ${safeStatus} response.`;
    case "other":
    default:
      return `This URL returned a ${statusCode} ${safeStatus} response outside standard HTTP success and error ranges.`;
  }
}

export function recommendedActionForCategory(
  category: ResponseCodeCategory,
): string {
  switch (category) {
    case "server_error":
      return "Investigate server logs, fix the failing route, and re-crawl to confirm a stable 2xx response.";
    case "broken_page":
      return "Update or remove internal links pointing to this page, or restore the page if it should exist.";
    case "redirect":
      return "Update internal links to point directly to the destination URL and reduce unnecessary redirect hops.";
    case "success":
      return "No action needed.";
    case "other":
    default:
      return "Review this URL manually to confirm expected behavior and adjust server or crawl configuration if needed.";
  }
}
