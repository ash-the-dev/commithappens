import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { isInternalWebsiteIdFormat } from "@/lib/seo/crawl/website-site-id";
import { importApifyDatasetToSupabase, requireEnv } from "./import-apify-run";

dotenv.config({ path: ".env.local" });

const LOG = {
  start: (m: string) => console.log(`[START] ${m}`),
  info: (m: string) => console.log(`[INFO] ${m}`),
  success: (m: string) => console.log(`[SUCCESS] ${m}`),
  err: (m: string) => console.error(`[ERROR] ${m}`),
};

type ApifyStartRunResponse = {
  data?: {
    id?: string;
    status?: string;
    defaultDatasetId?: string;
  };
};

type ApifyRunResponse = {
  data?: {
    id?: string;
    status?: string;
    defaultDatasetId?: string;
  };
};

const TERMINAL_FAILURE_STATUSES = new Set(["FAILED", "ABORTED", "TIMED-OUT"]);
const TERMINAL_SUCCESS_STATUS = "SUCCEEDED";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readPollIntervalMs(): number {
  const raw = process.env.APIFY_POLL_INTERVAL_MS?.trim();
  if (!raw) return 5000;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 500) {
    throw new Error("APIFY_POLL_INTERVAL_MS must be an integer >= 500");
  }
  return parsed;
}

function parseActorInputFromEnv(): unknown {
  const input = process.env.APIFY_ACTOR_INPUT_JSON?.trim();
  if (!input) return undefined;
  try {
    return JSON.parse(input);
  } catch {
    throw new Error("APIFY_ACTOR_INPUT_JSON is not valid JSON");
  }
}

async function startApifyActorRun(
  token: string,
  actorId: string,
  actorInput: unknown,
): Promise<{ runId: string; status: string; defaultDatasetId: string | null }> {
  const url = new URL(`https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs`);
  url.searchParams.set("token", token);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(actorInput ?? {}),
  });

  if (!res.ok) {
    throw new Error(`Apify actor start failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as ApifyStartRunResponse;
  const runId = data.data?.id;
  const status = data.data?.status;
  const defaultDatasetId = data.data?.defaultDatasetId ?? null;

  if (!runId || !status) {
    throw new Error("Apify actor start did not return run id/status");
  }

  return { runId, status, defaultDatasetId };
}

async function fetchApifyRun(token: string, runId: string): Promise<{ status: string; defaultDatasetId: string | null }> {
  const url = new URL(`https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}`);
  url.searchParams.set("token", token);
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`Apify run fetch failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as ApifyRunResponse;
  const status = data.data?.status;
  const defaultDatasetId = data.data?.defaultDatasetId ?? null;
  if (!status) {
    throw new Error("Apify run response missing status");
  }
  return { status, defaultDatasetId };
}

async function waitForRunCompletion(
  token: string,
  runId: string,
  pollIntervalMs: number,
  initialStatus: string,
): Promise<{ status: string; defaultDatasetId: string | null }> {
  let status = initialStatus;
  let defaultDatasetId: string | null = null;

  LOG.info(`Polling run ${runId} every ${pollIntervalMs}ms`);

  for (;;) {
    if (status === TERMINAL_SUCCESS_STATUS) {
      return { status, defaultDatasetId };
    }
    if (TERMINAL_FAILURE_STATUSES.has(status)) {
      throw new Error(`Apify run ${runId} ended with failure status: ${status}`);
    }

    await sleep(pollIntervalMs);
    const latest = await fetchApifyRun(token, runId);
    status = latest.status;
    defaultDatasetId = latest.defaultDatasetId;
    LOG.info(`Run ${runId} status: ${status}`);
  }
}

export async function runApifyAndImportFromEnv(): Promise<void> {
  const apifyToken = requireEnv("APIFY_TOKEN", LOG);
  const actorId = requireEnv("APIFY_ACTOR_ID", LOG);
  const supabaseUrl = requireEnv("SUPABASE_URL", LOG);
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", LOG);
  const siteId = requireEnv("SEO_SITE_ID", LOG);
  if (!isInternalWebsiteIdFormat(siteId)) {
    LOG.err(
      `SEO_SITE_ID must be your CommitHappens website UUID (websites.id), not an Apify id. Got: "${siteId}"`,
    );
    process.exit(1);
  }
  const pollIntervalMs = readPollIntervalMs();
  const actorInput = parseActorInputFromEnv();

  LOG.start("Starting Apify actor and importing crawl results");
  const started = await startApifyActorRun(apifyToken, actorId, actorInput);
  LOG.info(`Actor started: run_id=${started.runId}`);

  const finished = await waitForRunCompletion(
    apifyToken,
    started.runId,
    pollIntervalMs,
    started.status,
  );

  if (finished.status !== TERMINAL_SUCCESS_STATUS) {
    throw new Error(`Apify run ${started.runId} did not succeed (status=${finished.status})`);
  }

  const datasetId = finished.defaultDatasetId;
  if (!datasetId) {
    throw new Error(`Apify run ${started.runId} succeeded but did not include defaultDatasetId`);
  }
  LOG.info(`Run succeeded. Dataset ID: ${datasetId}`);

  const result = await importApifyDatasetToSupabase({
    apifyToken,
    datasetId,
    supabaseUrl,
    serviceKey,
    siteId,
    actorId,
    actorRunId: started.runId,
    logger: LOG,
  });

  LOG.success(
    `Automation complete: run_id=${started.runId} dataset_id=${result.datasetId} report_id=${result.reportId}`,
  );
}

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  runApifyAndImportFromEnv().catch((err) => {
    LOG.err(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
