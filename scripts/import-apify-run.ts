import dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildResponseCodeReportFromNormalizedRows } from "@/lib/seo/report/report-builder";
import { normalizeApifyDatasetItems, type NormalizedCrawlRow } from "@/lib/seo/apify/normalize";

dotenv.config({ path: ".env.local" });

type Logger = {
  start: (message: string) => void;
  info: (message: string) => void;
  success: (message: string) => void;
  err: (message: string) => void;
};

const LOG: Logger = {
  start: (m: string) => console.log(`[START] ${m}`),
  info: (m: string) => console.log(`[INFO] ${m}`),
  success: (m: string) => console.log(`[SUCCESS] ${m}`),
  err: (m: string) => console.error(`[ERROR] ${m}`),
};

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
  loadEnvFileIfPresent(join(process.cwd(), ".env.local"));
}

type ApifyListResponse = {
  data?: { items: unknown[] };
  items?: unknown[];
};

export function requireEnv(name: string, logger: Logger = LOG): string {
  const v = process.env[name]?.trim();
  if (!v) {
    logger.err(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return v;
}

type ApifyActorRunResponse = {
  data?: { defaultDatasetId?: string };
  defaultDatasetId?: string;
};

/**
 * GET /v2/actor-runs/:runId — the run points at the result dataset.
 */
export async function fetchDefaultDatasetIdFromRun(token: string, runId: string): Promise<string> {
  const url = new URL(`https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}`);
  url.searchParams.set("token", token);
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify run lookup failed (${res.status}): ${text}`);
  }
  const body = (await res.json()) as ApifyActorRunResponse;
  const id =
    (body.data && typeof body.data.defaultDatasetId === "string" && body.data.defaultDatasetId) ||
    (typeof body.defaultDatasetId === "string" ? body.defaultDatasetId : null);
  if (!id) {
    throw new Error("Actor run response did not include defaultDatasetId");
  }
  return id;
}

async function fetchAllDatasetItems(
  token: string,
  datasetId: string,
  onInfo: (msg: string) => void,
): Promise<unknown[]> {
  const all: unknown[] = [];
  const pageSize = 1000;
  let offset = 0;

  for (;;) {
    const url = new URL(`https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items`);
    url.searchParams.set("token", token);
    url.searchParams.set("format", "json");
    url.searchParams.set("clean", "1");
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("limit", String(pageSize));

    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Apify request failed (${res.status}): ${text}`);
    }

    const body = (await res.json()) as unknown;
    let batch: unknown[] = [];
    if (Array.isArray(body)) {
      batch = body;
    } else if (body && typeof body === "object") {
      const o = body as ApifyListResponse;
      if (Array.isArray(o.data?.items)) batch = o.data.items;
      else if (Array.isArray(o.items)) batch = o.items;
    }

    onInfo(`Page offset=${offset} fetched: ${batch.length} items (total so far: ${all.length + batch.length})`);
    all.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

function chunkInsert<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    out.push(rows.slice(i, i + size));
  }
  return out;
}

async function createCrawlRunWithFallback(
  supabase: SupabaseClient,
  input: {
    siteId: string;
    actorId: string | null;
    actorRunId: string | null;
    datasetId: string;
    pagesCrawled: number;
  },
): Promise<string> {
  const fullPayload = {
    site_id: input.siteId,
    source: "apify",
    actor_id: input.actorId,
    actor_run_id: input.actorRunId,
    dataset_id: input.datasetId,
    status: "completed",
    pages_crawled: input.pagesCrawled,
  };

  const { data: fullRun, error: fullError } = await supabase
    .from("seo_crawl_runs")
    .insert(fullPayload)
    .select("id")
    .single();

  if (!fullError && fullRun?.id) {
    return fullRun.id as string;
  }

  const errorMessage = fullError?.message ?? "";
  if (!errorMessage.includes("Could not find") || !errorMessage.includes("column")) {
    throw new Error(`Failed to create seo_crawl_runs: ${errorMessage || "no row returned"}`);
  }

  LOG.info("seo_crawl_runs is missing one or more optional columns; retrying with minimal payload.");
  const minimalPayload = {
    site_id: input.siteId,
    status: "completed",
    pages_crawled: input.pagesCrawled,
  };

  const { data: minimalRun, error: minimalError } = await supabase
    .from("seo_crawl_runs")
    .insert(minimalPayload)
    .select("id")
    .single();

  if (minimalError || !minimalRun?.id) {
    throw new Error(
      `Failed to create seo_crawl_runs (minimal retry): ${minimalError?.message ?? "no row returned"}`,
    );
  }
  return minimalRun.id as string;
}

async function insertResponseCodeReportWithFallback(
  supabase: SupabaseClient,
  input: {
    siteId: string;
    report: unknown;
    crawlRunId: string;
    datasetId: string;
  },
): Promise<{ id: string; created_at: string }> {
  const fullPayload = {
    site_id: input.siteId,
    report_json: input.report,
    source: "apify",
    crawl_run_id: input.crawlRunId,
    source_dataset_id: input.datasetId,
    processing_status: "completed",
  };

  const { data: fullRow, error: fullError } = await supabase
    .from("response_code_reports")
    .insert(fullPayload)
    .select("id, created_at")
    .single();

  if (!fullError && fullRow?.id && fullRow?.created_at) {
    return { id: fullRow.id as string, created_at: String(fullRow.created_at) };
  }

  const errorMessage = fullError?.message ?? "";
  if (!errorMessage.includes("Could not find") || !errorMessage.includes("column")) {
    throw new Error(`Failed to insert response_code_reports: ${errorMessage || "no row returned"}`);
  }

  LOG.info("response_code_reports is missing one or more optional metadata columns; retrying minimal insert.");
  const minimalPayload = {
    site_id: input.siteId,
    report_json: input.report,
  };

  const { data: minimalRow, error: minimalError } = await supabase
    .from("response_code_reports")
    .insert(minimalPayload)
    .select("id, created_at")
    .single();

  if (minimalError || !minimalRow?.id || !minimalRow?.created_at) {
    throw new Error(
      `Failed to insert response_code_reports (minimal retry): ${minimalError?.message ?? "no row returned"}`,
    );
  }
  return { id: minimalRow.id as string, created_at: String(minimalRow.created_at) };
}

type ImportApifyDatasetArgs = {
  apifyToken: string;
  datasetId: string;
  supabaseUrl: string;
  serviceKey: string;
  siteId: string;
  actorId: string | null;
  actorRunId: string | null;
  logger?: Logger;
};

export async function importApifyDatasetToSupabase({
  apifyToken,
  datasetId,
  supabaseUrl,
  serviceKey,
  siteId,
  actorId,
  actorRunId,
  logger = LOG,
}: ImportApifyDatasetArgs): Promise<{
  datasetId: string;
  crawlRunId: string;
  reportId: string;
  reportCreatedAt: string;
  rawItemsCount: number;
  normalizedCount: number;
}> {
  const sourceLabel = `apify:${datasetId}`;

  const rawItems = await fetchAllDatasetItems(apifyToken, datasetId, (m) => logger.info(m));
  if (rawItems.length === 0) {
    throw new Error("Apify returned no items");
  }
  logger.info(`Dataset items fetched: ${rawItems.length}`);

  const parseErrors: string[] = [];
  const normalized: NormalizedCrawlRow[] = normalizeApifyDatasetItems(rawItems, (msg) => {
    parseErrors.push(msg);
  });
  for (const e of parseErrors) {
    logger.info(e);
  }

  if (normalized.length === 0) {
    throw new Error("No valid rows after normalization (every row missing url or invalid)");
  }
  logger.info(`Normalized rows: ${normalized.length}`);

  const supabase: SupabaseClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const crawlRunId = await createCrawlRunWithFallback(supabase, {
    siteId,
    actorId,
    actorRunId,
    datasetId,
    pagesCrawled: normalized.length,
  });
  logger.info(`Crawl run created: ${crawlRunId}`);

  const pageRows = normalized.map((row) => ({
    crawl_run_id: crawlRunId,
    site_id: siteId,
    url: row.url,
    status: row.status,
    title: row.title,
    meta_description: row.metaDescription,
    h1: row.h1,
    links: row.links,
  }));

  for (const part of chunkInsert(pageRows, 500)) {
    const { error: pageErr } = await supabase.from("seo_crawl_pages").insert(part);
    if (pageErr) {
      throw new Error(`Failed to insert seo_crawl_pages: ${pageErr.message}`);
    }
  }
  logger.info(`Crawl pages inserted: ${normalized.length}`);

  const report = buildResponseCodeReportFromNormalizedRows(normalized, sourceLabel);
  logger.info("Report generated");

  const reportRow = await insertResponseCodeReportWithFallback(supabase, {
    siteId,
    report,
    crawlRunId,
    datasetId,
  });

  logger.success(
    `response_code_reports row inserted: id=${reportRow.id} created_at=${reportRow.created_at}`,
  );

  return {
    datasetId,
    crawlRunId,
    reportId: reportRow.id,
    reportCreatedAt: reportRow.created_at,
    rawItemsCount: rawItems.length,
    normalizedCount: normalized.length,
  };
}

export async function runImportApifyFromEnv(logger: Logger = LOG): Promise<void> {
  loadEnvFiles();
  logger.start("Importing Apify dataset");

  const apifyToken = requireEnv("APIFY_TOKEN", logger);
  const supabaseUrl = requireEnv("SUPABASE_URL", logger);
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", logger);
  const siteId = requireEnv("SEO_SITE_ID", logger);
  const actorId = process.env.APIFY_ACTOR_ID?.trim() || null;
  const actorRunId = process.env.APIFY_ACTOR_RUN_ID?.trim() || null;
  const datasetIdFromEnv = process.env.APIFY_DATASET_ID?.trim() || null;

  if (!datasetIdFromEnv && !actorRunId) {
    logger.err("Set APIFY_DATASET_ID and/or APIFY_ACTOR_RUN_ID (run ID can be used to resolve the dataset).");
    process.exit(1);
  }

  let datasetId = datasetIdFromEnv;
  if (datasetId && actorRunId) {
    logger.info(`Using APIFY_DATASET_ID=${datasetId} (APIFY_ACTOR_RUN_ID is also set; fix the dataset ID or remove it to force resolution from the run).`);
  }
  if (!datasetId && actorRunId) {
    datasetId = await fetchDefaultDatasetIdFromRun(apifyToken, actorRunId);
    logger.info(`Resolved dataset from run: ${datasetId}`);
  }

  let finalDatasetId = datasetId!;
  try {
    await importApifyDatasetToSupabase({
      apifyToken,
      datasetId: finalDatasetId,
      supabaseUrl,
      serviceKey,
      siteId,
      actorId,
      actorRunId,
      logger,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("404") && actorRunId && datasetIdFromEnv) {
      logger.info("Dataset ID failed with 404; retrying with defaultDatasetId from APIFY_ACTOR_RUN_ID…");
      finalDatasetId = await fetchDefaultDatasetIdFromRun(apifyToken, actorRunId);
      logger.info(`Using dataset: ${finalDatasetId}`);
      await importApifyDatasetToSupabase({
        apifyToken,
        datasetId: finalDatasetId,
        supabaseUrl,
        serviceKey,
        siteId,
        actorId,
        actorRunId,
        logger,
      });
    } else {
      throw e;
    }
  }
}

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  runImportApifyFromEnv().catch((err) => {
    LOG.err(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
