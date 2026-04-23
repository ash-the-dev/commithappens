import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import {
  buildResponseCodeReportFromCsvText,
  buildResponseCodeReportFromParsed,
} from "./report-builder";
import { emptyParsedResponseCodes } from "./parser";

const DEFAULT_SOURCE = "response_codes_all.csv";

export async function buildResponseCodeReportFromFile(filePath: string) {
  const source = basename(filePath) || DEFAULT_SOURCE;
  const safe = emptyParsedResponseCodes(source);

  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not read response code CSV file.";
    safe.errors.push(message);
    return buildResponseCodeReportFromParsed(safe);
  }

  try {
    return buildResponseCodeReportFromCsvText(content, source);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to parse response code CSV file.";
    safe.errors.push(message);
    return buildResponseCodeReportFromParsed(safe);
  }
}
