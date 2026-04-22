import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import {
  issueDetails,
  issueTitleForCategory,
  mapStatusCodeToCategory,
  mapStatusCodeToSeverity,
  recommendedActionForCategory,
  type ResponseCodeCategory,
  type ResponseCodeSeverity,
} from "@/lib/seo-parser/parsers/responseCodeHelpers";

type CsvHeaderMap = {
  address: string;
  statusCode: string;
  status: string | null;
  contentType: string | null;
};

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

function emptyResult(source = DEFAULT_SOURCE): ParsedResponseCodes {
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
  const statusCode = findHeader(headers, [
    "Status Code",
    "StatusCode",
    "HTTP Status Code",
  ]);
  const status = findHeader(headers, ["Status", "Status Text", "Status Message"]);
  const contentType = findHeader(headers, [
    "Content Type",
    "ContentType",
    "MIME Type",
  ]);

  if (!address || !statusCode) {
    throw new Error(
      "Missing required columns. Expected at least Address and Status Code headers.",
    );
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
    const key = headers[i];
    out[key] = (row[i] ?? "").trim();
  }
  return out;
}

function toStatusCode(value: string): number | null {
  if (!value) return null;
  const numeric = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
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

function parseResponseCodesCsv(
  csvContent: string,
  source = DEFAULT_SOURCE,
): ParsedResponseCodes {
  const result = emptyResult(source);

  if (!csvContent.trim()) {
    throw new Error("CSV file is empty.");
  }

  const rows = parseCsv(csvContent);
  if (rows.length === 0) {
    throw new Error("CSV file did not contain any rows.");
  }

  const headers = rows[0].map((header) => header.trim());
  const headerMap = getHeaderMap(headers);

  const addressKey = headerMap.address;
  const statusCodeKey = headerMap.statusCode;
  const statusKey = headerMap.status;
  const contentTypeKey = headerMap.contentType;

  for (let i = 1; i < rows.length; i += 1) {
    const rowValues = rows[i];
    if (rowValues.length === 1 && !rowValues[0]) {
      continue;
    }

    const raw = toRecord(headers, rowValues);
    const url = (raw[addressKey] ?? "").trim();
    if (!url) {
      continue;
    }

    const statusCode = toStatusCode(raw[statusCodeKey] ?? "");
    if (statusCode == null) {
      result.errors.push(
        `Skipped malformed row ${i + 1}: invalid status code for URL ${url}`,
      );
      continue;
    }

    const status = statusKey ? (raw[statusKey] ?? "").trim() : "";
    const contentType = contentTypeKey
      ? (raw[contentTypeKey] ?? "").trim() || null
      : null;

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

export async function parseResponseCodes(
  filePath: string,
): Promise<ParsedResponseCodes> {
  const source = basename(filePath) || DEFAULT_SOURCE;
  const safeErrorResult = emptyResult(source);

  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not read response code CSV file.";
    safeErrorResult.errors.push(message);
    return safeErrorResult;
  }

  try {
    return parseResponseCodesCsv(content, source);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to parse response code CSV file.";
    safeErrorResult.errors.push(message);
    return safeErrorResult;
  }
}

export { parseResponseCodesCsv };

/**
 * Quick local example:
 *
 * const result = await parseResponseCodes(
 *   "/path/to/response_codes_all.csv",
 * );
 * console.log(result.summary, result.issues.slice(0, 5));
 */
