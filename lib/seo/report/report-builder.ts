import type { NormalizedCrawlRow } from "@/lib/seo/apify/normalize";
import { buildResponseCodeReportFromParsed, type ResponseCodeReport } from "@/lib/seo/response-codes/report-builder";
import { parseResponseCodesFromNormalizedRows } from "@/lib/seo/response-codes/parser";

export type { ResponseCodeReport };

/**
 * {@link parseResponseCodesFromNormalizedRows} + existing insights + voice.
 */
export function buildResponseCodeReportFromNormalizedRows(
  rows: NormalizedCrawlRow[],
  source: string,
): ResponseCodeReport {
  const parsed = parseResponseCodesFromNormalizedRows(rows, source);
  return buildResponseCodeReportFromParsed(parsed);
}
