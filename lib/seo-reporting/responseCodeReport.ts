import { parseResponseCodes } from "@/lib/seo-parser";
import { buildResponseCodeInsights } from "@/lib/seo-insights/responseCodeInsights";
import { buildResponseCodeVoice } from "@/lib/seo-voice/responseCodeVoice";

type ResponseCodeParseSummary = {
  totalUrls: number;
  healthy: number;
  redirects: number;
  clientErrors: number;
  serverErrors: number;
  other: number;
};

type ResponseCodeParseSeverity = {
  critical: number;
  warning: number;
  healthy: number;
  info: number;
};

type ResponseCodeParseResultLike = {
  source: string;
  summary: ResponseCodeParseSummary;
  severity: ResponseCodeParseSeverity;
  rows: unknown[];
  issues: Array<Record<string, unknown>>;
  errors: unknown[];
};

type ResponseCodeInsightsResult = ReturnType<typeof buildResponseCodeInsights>;
type ResponseCodeVoiceResult = ReturnType<typeof buildResponseCodeVoice>;

export type ResponseCodeReport = {
  raw: ResponseCodeParseResultLike;
  insights: ResponseCodeInsightsResult;
  voice: ResponseCodeVoiceResult;
};

const EMPTY_RAW: ResponseCodeParseResultLike = {
  source: "response_codes_all.csv",
  summary: {
    totalUrls: 0,
    healthy: 0,
    redirects: 0,
    clientErrors: 0,
    serverErrors: 0,
    other: 0,
  },
  severity: {
    critical: 0,
    warning: 0,
    healthy: 0,
    info: 0,
  },
  rows: [],
  issues: [],
  errors: [],
};

function emptyRaw(): ResponseCodeParseResultLike {
  return {
    source: EMPTY_RAW.source,
    summary: { ...EMPTY_RAW.summary },
    severity: { ...EMPTY_RAW.severity },
    rows: [],
    issues: [],
    errors: [],
  };
}

function isParseResultLike(input: unknown): input is ResponseCodeParseResultLike {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Record<string, unknown>;

  return (
    typeof candidate.source === "string" &&
    candidate.summary !== null &&
    typeof candidate.summary === "object" &&
    candidate.severity !== null &&
    typeof candidate.severity === "object" &&
    Array.isArray(candidate.rows) &&
    Array.isArray(candidate.issues) &&
    Array.isArray(candidate.errors)
  );
}

export function buildResponseCodeReportFromParseResult(
  parseResult: unknown,
): ResponseCodeReport {
  const raw = isParseResultLike(parseResult) ? parseResult : emptyRaw();
  const insights = buildResponseCodeInsights(raw);
  const voice = buildResponseCodeVoice(insights);

  return {
    raw,
    insights,
    voice,
  };
}

export async function buildResponseCodeReportFromFile(
  filePath: string,
): Promise<ResponseCodeReport> {
  const parseResult = await parseResponseCodes(filePath);
  return buildResponseCodeReportFromParseResult(parseResult);
}

/**
 * Usage:
 * const report = buildResponseCodeReportFromParseResult(parseResult);
 * const reportFromFile = await buildResponseCodeReportFromFile("/path/to/response_codes_all.csv");
 */
