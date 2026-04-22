import { buildResponseCodeReportFromFile } from "../lib/seo-reporting/responseCodeReport";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Load KEY=VALUE lines from a file into process.env (first wins if already set).
 * Used for local dev (.env.local) and VM: point SEO_ENV_FILE to a root-owned file, e.g.
 * /home/ubuntu/.config/ash-ops/seo.env
 */
function loadEnvFileIfPresent(filePath: string): void {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function loadEnvFiles(): void {
  const explicit = process.env.SEO_ENV_FILE?.trim();
  if (explicit) {
    loadEnvFileIfPresent(explicit);
  }
  // Dev machine convention (repo)
  loadEnvFileIfPresent(join(process.cwd(), ".env.local"));
}

function resolveCsvPath(): string {
  const explicit = process.env.SEO_RESPONSE_CODES_CSV_PATH?.trim();
  if (explicit) return explicit;
  if (process.env.NODE_ENV === "production") {
    return "/home/ubuntu/seo-exports/response_codes_all.csv";
  }
  return "seo-exports/response_codes_all.csv";
}

async function run(): Promise<void> {
  loadEnvFiles();
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const siteId = process.env.SEO_REPORT_SITE_ID?.trim() || "default";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const filePath = resolveCsvPath();
  const report = await buildResponseCodeReportFromFile(filePath);

  const res = await fetch(`${supabaseUrl}/rest/v1/response_code_reports`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      site_id: siteId,
      report_json: report,
    }),
  });

  if (!res.ok) {
    throw new Error(`Supabase upload failed (${res.status}): ${await res.text()}`);
  }

  const rows = (await res.json()) as Array<{ id: string; created_at: string }>;
  const inserted = rows[0];
  console.log(
    `[seo][response-codes] uploaded report: id=${inserted?.id ?? "unknown"} created_at=${inserted?.created_at ?? "unknown"}`,
  );
}

run().catch((err) => {
  console.error("[seo][response-codes] upload failed", err);
  process.exit(1);
});
