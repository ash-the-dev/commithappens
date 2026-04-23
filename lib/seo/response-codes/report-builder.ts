import {
  parseResponseCodesCsvText,
  type ParsedResponseCodes,
} from "./parser";
import { buildResponseCodeInsights, type ResponseCodeInsights } from "./insights";
import { buildResponseCodeVoice, type ResponseCodeVoice } from "./voice";

export type ResponseCodeReport = {
  raw: ParsedResponseCodes;
  insights: ResponseCodeInsights;
  voice: ResponseCodeVoice;
};

const DEFAULT_SOURCE = "response_codes_all.csv";

export function buildResponseCodeReportFromParsed(parsed: ParsedResponseCodes): ResponseCodeReport {
  const insights = buildResponseCodeInsights(parsed);
  const voice = buildResponseCodeVoice(insights);
  return { raw: parsed, insights, voice };
}

export function buildResponseCodeReportFromCsvText(
  csvContent: string,
  source = DEFAULT_SOURCE,
): ResponseCodeReport {
  const parsed = parseResponseCodesCsvText(csvContent, source);
  return buildResponseCodeReportFromParsed(parsed);
}
