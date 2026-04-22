import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseResponseCodesCsv } from "@/lib/seo-parser";

/**
 * Tiny local verification script:
 * `npx tsx lib/seo-parser/parsers/parseResponseCodes.sample.ts`
 */
async function runSample() {
  const samplePath = resolve(
    process.cwd(),
    "lib/seo-parser/parsers/__fixtures__/response_codes_sample.csv",
  );
  const csv = await readFile(samplePath, "utf8");
  const result = parseResponseCodesCsv(csv, "response_codes_sample.csv");

  const okRow = result.rows.find((row) => row.statusCode === 200);
  const movedRow = result.rows.find((row) => row.statusCode === 301);
  const missingRow = result.rows.find((row) => row.statusCode === 404);
  const errorRow = result.rows.find((row) => row.statusCode === 500);

  if (!okRow || okRow.category !== "success" || okRow.severity !== "healthy") {
    throw new Error("Expected 200 to map to success + healthy.");
  }
  if (
    !movedRow ||
    movedRow.category !== "redirect" ||
    movedRow.severity !== "warning"
  ) {
    throw new Error("Expected 301 to map to redirect + warning.");
  }
  if (
    !missingRow ||
    missingRow.category !== "broken_page" ||
    missingRow.severity !== "critical"
  ) {
    throw new Error("Expected 404 to map to broken_page + critical.");
  }
  if (
    !errorRow ||
    errorRow.category !== "server_error" ||
    errorRow.severity !== "critical"
  ) {
    throw new Error("Expected 500 to map to server_error + critical.");
  }

  console.log("Response code sample checks passed.");
}

void runSample();
