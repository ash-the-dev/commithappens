import type { NormalizedCrawlRow } from "@/lib/seo/apify/normalize";

export type ResponseCodeSeverity = "critical" | "warning" | "healthy" | "info";

export type ResponseCodeCategory =
  | "server_error"
  | "broken_page"
  | "redirect"
  | "success"
  | "other";

export type ParsedResponseCodeRow = {
  url: string;
  statusCode: number;
  status: string;
  contentType: string | null;
  severity: ResponseCodeSeverity;
  category: ResponseCodeCategory;
};

export type ResponseCodeIssue = {
  url: string;
  statusCode: number;
  status: string;
  category: ResponseCodeCategory;
  severity: ResponseCodeSeverity;
  issueTitle: string;
  details: string;
  recommendedAction: string;
};

export type ResponseCodeSummary = {
  totalUrls: number;
  healthy: number;
  redirects: number;
  clientErrors: number;
  serverErrors: number;
  other: number;
};

export type ResponseCodeSeverityCounts = {
  critical: number;
  warning: number;
  healthy: number;
  info: number;
};

export type ParsedResponseCodes = {
  source: string;
  summary: ResponseCodeSummary;
  severity: ResponseCodeSeverityCounts;
  rows: ParsedResponseCodeRow[];
  issues: ResponseCodeIssue[];
  errors: string[];
};

type CsvHeaderMap = {
  address: string;
  statusCode: string;
  status: string | null;
  contentType: string | null;
};

const DEFAULT_SOURCE = "response_codes_all.csv";

const EMPTY_SUMMARY: ResponseCodeSummary = {
  totalUrls: 0,
  healthy: 0,
  redirects: 0,
  clientErrors: 0,
  serverErrors: 0,
  other: 0,
};

const EMPTY_SEVERITY: ResponseCodeSeverityCounts = {
  critical: 0,
  warning: 0,
  healthy: 0,
  info: 0,
};

export function emptyParsedResponseCodes(source = DEFAULT_SOURCE): ParsedResponseCodes {
  return {
    source,
    summary: { ...EMPTY_SUMMARY },
    severity: { ...EMPTY_SEVERITY },
    rows: [],
    issues: [],
    errors: [],
  };
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function findHeader(headers: string[], variants: string[]): string | null {
  const normalizedTargets = new Set(variants.map((v) => normalizeHeader(v)));
  for (const header of headers) {
    if (normalizedTargets.has(normalizeHeader(header))) {
      return header;
    }
  }
  return null;
}

function getHeaderMap(headers: string[]): CsvHeaderMap {
  const address = findHeader(headers, ["Address", "URL", "Uri"]);
  const statusCode = findHeader(headers, ["Status Code", "StatusCode", "HTTP Status Code"]);
  const status = findHeader(headers, ["Status", "Status Text", "Status Message"]);
  const contentType = findHeader(headers, ["Content Type", "ContentType", "MIME Type"]);

  if (!address || !statusCode) {
    throw new Error("Missing required columns. Expected at least Address and Status Code headers.");
  }

  return { address, statusCode, status, contentType };
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value.trim());
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value.trim());
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value.trim());
    rows.push(row);
  }

  return rows;
}

function toRecord(headers: string[], row: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < headers.length; i += 1) {
    out[headers[i]] = (row[i] ?? "").trim();
  }
  return out;
}

function toStatusCode(value: string): number | null {
  if (!value) return null;
  const numeric = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

function mapStatusCodeToSeverity(statusCode: number): ResponseCodeSeverity {
  if (statusCode >= 500 && statusCode <= 599) return "critical";
  if (statusCode >= 400 && statusCode <= 499) return "critical";
  if (statusCode >= 300 && statusCode <= 399) return "warning";
  if (statusCode >= 200 && statusCode <= 299) return "healthy";
  return "info";
}

function mapStatusCodeToCategory(statusCode: number): ResponseCodeCategory {
  if (statusCode >= 500 && statusCode <= 599) return "server_error";
  if (statusCode >= 400 && statusCode <= 499) return "broken_page";
  if (statusCode >= 300 && statusCode <= 399) return "redirect";
  if (statusCode >= 200 && statusCode <= 299) return "success";
  return "other";
}

function issueTitleForCategory(category: ResponseCodeCategory): string {
  if (category === "server_error") return "Server error page";
  if (category === "broken_page") return "Broken page";
  if (category === "redirect") return "Redirected URL";
  if (category === "success") return "Healthy page";
  return "Unclassified response";
}

function issueDetails(statusCode: number, status: string, category: ResponseCodeCategory): string {
  const safeStatus = status || "Unknown";
  if (category === "server_error") return `This URL returned a ${statusCode} ${safeStatus} response from the server.`;
  if (category === "broken_page") return `This URL returned a ${statusCode} ${safeStatus} response.`;
  if (category === "redirect") return `This URL returned a ${statusCode} ${safeStatus} redirect response.`;
  if (category === "success") return `This URL returned a ${statusCode} ${safeStatus} response.`;
  return `This URL returned a ${statusCode} ${safeStatus} response outside standard HTTP success and error ranges.`;
}

function recommendedActionForCategory(category: ResponseCodeCategory): string {
  if (category === "server_error") {
    return "Investigate server logs, fix the failing route, and re-crawl to confirm a stable 2xx response.";
  }
  if (category === "broken_page") {
    return "Update or remove internal links pointing to this page, or restore the page if it should exist.";
  }
  if (category === "redirect") {
    return "Update internal links to point directly to the destination URL and reduce unnecessary redirect hops.";
  }
  if (category === "success") return "No action needed.";
  return "Review this URL manually to confirm expected behavior and adjust server or crawl configuration if needed.";
}

function updateSummary(summary: ResponseCodeSummary, statusCode: number): void {
  summary.totalUrls += 1;
  if (statusCode >= 200 && statusCode <= 299) {
    summary.healthy += 1;
  } else if (statusCode >= 300 && statusCode <= 399) {
    summary.redirects += 1;
  } else if (statusCode >= 400 && statusCode <= 499) {
    summary.clientErrors += 1;
  } else if (statusCode >= 500 && statusCode <= 599) {
    summary.serverErrors += 1;
  } else {
    summary.other += 1;
  }
}

function toIssue(row: ParsedResponseCodeRow): ResponseCodeIssue {
  return {
    url: row.url,
    statusCode: row.statusCode,
    status: row.status,
    category: row.category,
    severity: row.severity,
    issueTitle: issueTitleForCategory(row.category),
    details: issueDetails(row.statusCode, row.status, row.category),
    recommendedAction: recommendedActionForCategory(row.category),
  };
}

/**
 * Build the same ParsedResponseCodes structure as CSV parsing, from normalized Apify crawl rows.
 */
export function parseResponseCodesFromNormalizedRows(
  rows: NormalizedCrawlRow[],
  source = DEFAULT_SOURCE,
): ParsedResponseCodes {
  const result = emptyParsedResponseCodes(source);

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const url = row.url.trim();
    if (!url) {
      result.errors.push(`Skipped row ${i + 1}: empty URL`);
      continue;
    }

    // NormalizedCrawlRow.status = HTTP response code (same as `seo_crawl_pages.status`); not a DB column named status_code.
    const statusCode = row.status;
    if (statusCode == null) {
      result.errors.push(`Skipped ${url}: missing or invalid HTTP status`);
      continue;
    }

    const status = String(statusCode);
    const contentType: string | null = null;
    const category = mapStatusCodeToCategory(statusCode);
    const severity = mapStatusCodeToSeverity(statusCode);

    const parsedRow: ParsedResponseCodeRow = {
      url,
      statusCode,
      status,
      contentType,
      category,
      severity,
    };

    result.rows.push(parsedRow);
    result.severity[severity] += 1;
    updateSummary(result.summary, statusCode);
    if (category !== "success") {
      result.issues.push(toIssue(parsedRow));
    }
  }

  return result;
}

export function parseResponseCodesCsvText(
  csvContent: string,
  source = DEFAULT_SOURCE,
): ParsedResponseCodes {
  const result = emptyParsedResponseCodes(source);

  if (!csvContent.trim()) {
    throw new Error("CSV file is empty.");
  }

  const rows = parseCsv(csvContent);
  if (rows.length === 0) {
    throw new Error("CSV file did not contain any rows.");
  }

  const headers = rows[0].map((header) => header.trim());
  const headerMap = getHeaderMap(headers);

  for (let i = 1; i < rows.length; i += 1) {
    const rowValues = rows[i];
    if (rowValues.length === 1 && !rowValues[0]) continue;

    const raw = toRecord(headers, rowValues);
    const url = (raw[headerMap.address] ?? "").trim();
    if (!url) continue;

    const statusCode = toStatusCode(raw[headerMap.statusCode] ?? "");
    if (statusCode == null) {
      result.errors.push(`Skipped malformed row ${i + 1}: invalid status code for URL ${url}`);
      continue;
    }

    const status = headerMap.status ? (raw[headerMap.status] ?? "").trim() : "";
    const contentType = headerMap.contentType ? (raw[headerMap.contentType] ?? "").trim() || null : null;
    const category = mapStatusCodeToCategory(statusCode);
    const severity = mapStatusCodeToSeverity(statusCode);

    const parsedRow: ParsedResponseCodeRow = {
      url,
      statusCode,
      status,
      contentType,
      category,
      severity,
    };

    result.rows.push(parsedRow);
    result.severity[severity] += 1;
    updateSummary(result.summary, statusCode);
    if (category !== "success") {
      result.issues.push(toIssue(parsedRow));
    }
  }

  return result;
}
