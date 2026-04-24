import dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSeoCrawlRunSummary,
  classifySeoCrawlPageFromNormalizedRow,
  type SeoCrawlRunSummary,
} from "@/lib/seo/crawl/crawl-classification";
import { buildSeoCrawlPageRow } from "@/lib/seo/crawl/seo-crawl-page";
import { assertInternalWebsiteSiteId, isInternalWebsiteIdFormat } from "@/lib/seo/crawl/website-site-id";
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

function normalizeHostLike(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  const withProtocol = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function canonicalPageKey(url: URL): string {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, "");
  return `${host}${path.toLowerCase()}`;
}

function looksLikeDocumentPath(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  const excludedExt = [
    ".js",
    ".css",
    ".map",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".pdf",
    ".xml",
    ".txt",
    ".json",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".zip",
    ".mp4",
    ".webm",
  ];
  return !excludedExt.some((ext) => lower.endsWith(ext));
}

function filterNormalizedRowsForSite(
  rows: NormalizedCrawlRow[],
  primaryDomain: string,
  logger: Logger,
): NormalizedCrawlRow[] {
  const primaryHost = normalizeHostLike(primaryDomain);
  if (!primaryHost) return rows;
  const allowedHosts = new Set<string>([primaryHost]);
  if (primaryHost.startsWith("www.")) {
    allowedHosts.add(primaryHost.slice(4));
  } else {
    allowedHosts.add(`www.${primaryHost}`);
  }

  const deduped = new Map<string, NormalizedCrawlRow>();
  let droppedHost = 0;
  let droppedScheme = 0;
  let droppedNonDoc = 0;
  let droppedMalformed = 0;

  for (const row of rows) {
    try {
      const parsed = new URL(row.url);
      const protocol = parsed.protocol.toLowerCase();
      if (protocol !== "http:" && protocol !== "https:") {
        droppedScheme += 1;
        continue;
      }
      const host = parsed.hostname.toLowerCase();
      if (!allowedHosts.has(host)) {
        droppedHost += 1;
        continue;
      }
      if (!looksLikeDocumentPath(parsed.pathname)) {
        droppedNonDoc += 1;
        continue;
      }
      deduped.set(canonicalPageKey(parsed), row);
    } catch {
      droppedMalformed += 1;
    }
  }

  logger.info(
    `Site filter kept ${deduped.size}/${rows.length} rows (dropped: host=${droppedHost}, non_http=${droppedScheme}, non_doc=${droppedNonDoc}, malformed=${droppedMalformed})`,
  );
  return [...deduped.values()];
}

async function fetchPrimaryDomainForSite(
  supabase: SupabaseClient,
  siteId: string,
): Promise<string | null> {
  const result = await supabase
    .from("websites")
    .select("primary_domain")
    .eq("id", siteId)
    .limit(1)
    .maybeSingle();
  if (result.error) {
    throw new Error(`Failed to resolve website.primary_domain: ${result.error.message}`);
  }
  return (result.data?.primary_domain as string | undefined)?.trim() ?? null;
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
    external_source_id: input.actorRunId ?? input.datasetId,
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

  LOG.info("seo_crawl_runs is missing one or more optional columns; retrying with reduced payload.");
  const reducedPayload = {
    site_id: input.siteId,
    source: "apify",
    actor_id: input.actorId,
    actor_run_id: input.actorRunId,
    dataset_id: input.datasetId,
    status: "completed",
    pages_crawled: input.pagesCrawled,
  };

  const { data: reducedRun, error: reducedError } = await supabase
    .from("seo_crawl_runs")
    .insert(reducedPayload)
    .select("id")
    .single();

  if (!reducedError && reducedRun?.id) {
    return reducedRun.id as string;
  }

  const reducedMsg = reducedError?.message ?? "";
  if (!reducedMsg.includes("Could not find") || !reducedMsg.includes("column")) {
    throw new Error(`Failed to create seo_crawl_runs: ${reducedMsg || "no row returned"}`);
  }

  LOG.info("seo_crawl_runs retrying minimal payload (core columns only).");
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

/**
 * After pages are inserted, persist aggregate counts and health_score on the crawl run row.
 * If aggregate columns are not deployed yet, logs and skips (page rows would usually fail first).
 */
async function updateSeoCrawlRunAggregates(
  supabase: SupabaseClient,
  crawlRunId: string,
  runSummary: SeoCrawlRunSummary,
  logger: Logger,
): Promise<void> {
  const { error } = await supabase
    .from("seo_crawl_runs")
    .update({
      healthy_count: runSummary.healthy_count,
      notice_count: runSummary.notice_count,
      warning_count: runSummary.warning_count,
      critical_count: runSummary.critical_count,
      health_score: runSummary.health_score,
    })
    .eq("id", crawlRunId);

  if (!error) return;

  const msg = error.message ?? "";
  if (msg.includes("Could not find") && msg.includes("column")) {
    logger.info("seo_crawl_runs is missing intelligence aggregate columns; skipping run summary update.");
    return;
  }
  throw new Error(`Failed to update seo_crawl_runs aggregates: ${msg}`);
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

  const internalSiteId = await assertInternalWebsiteSiteId(supabase, siteId, "importApifyDatasetToSupabase");

  const primaryDomain = await fetchPrimaryDomainForSite(supabase, internalSiteId);
  const strictRows =
    primaryDomain && primaryDomain.length > 0
      ? filterNormalizedRowsForSite(normalized, primaryDomain, logger)
      : normalized;
  const filteredRows =
    strictRows.length > 0
      ? strictRows
      : (() => {
          logger.info(
            "Strict same-site filter removed all rows; falling back to normalized crawl rows for this run.",
          );
          return normalized;
        })();

  const crawlRunId = await createCrawlRunWithFallback(supabase, {
    siteId: internalSiteId,
    actorId,
    actorRunId,
    datasetId,
    pagesCrawled: filteredRows.length,
  });
  logger.info(`Crawl run created: ${crawlRunId}`);

  const classified = filteredRows.map((row) => ({
    row,
    cls: classifySeoCrawlPageFromNormalizedRow(row),
  }));

  const pageRows = classified.map(({ row, cls }) => {
    const built = buildSeoCrawlPageRow({
      crawlRunId,
      websiteIdText: internalSiteId,
      row,
    });
    return {
      crawl_run_id: built.crawl_run_id,
      site_id: built.site_id,
      url: built.url,
      status: built.status,
      title: built.title,
      meta_description: built.meta_description,
      h1: built.h1,
      links: built.links,
      issue_type: cls.issue_type,
      issue_severity: cls.issue_severity,
      crawl_notes: cls.crawl_notes,
    };
  });

  for (const part of chunkInsert(pageRows, 500)) {
    const { error: pageErr } = await supabase.from("seo_crawl_pages").insert(part);
    if (pageErr) {
      throw new Error(`Failed to insert seo_crawl_pages: ${pageErr.message}`);
    }
  }
  logger.info(`Crawl pages inserted: ${filteredRows.length}`);

  const runSummary = buildSeoCrawlRunSummary(classified.map((x) => x.cls));
  await updateSeoCrawlRunAggregates(supabase, crawlRunId, runSummary, logger);

  const report = buildResponseCodeReportFromNormalizedRows(filteredRows, sourceLabel);
  logger.info("Report generated");

  const reportRow = await insertResponseCodeReportWithFallback(supabase, {
    siteId: internalSiteId,
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
    normalizedCount: filteredRows.length,
  };
}

export async function runImportApifyFromEnv(logger: Logger = LOG): Promise<void> {
  loadEnvFiles();
  logger.start("Importing Apify dataset");

  const apifyToken = requireEnv("APIFY_TOKEN", logger);
  const supabaseUrl = requireEnv("SUPABASE_URL", logger);
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", logger);
  const siteId = requireEnv("SEO_SITE_ID", logger);
  if (!isInternalWebsiteIdFormat(siteId)) {
    logger.err(
      `SEO_SITE_ID must be your CommitHappens website UUID (websites.id from the app / DB), not an Apify run or dataset id. Got: "${siteId}"`,
    );
    process.exit(1);
  }
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
