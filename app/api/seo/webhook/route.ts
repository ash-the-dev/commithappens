import type { NextRequest } from "next/server";
import {
  getSeoCrawlRunByProviderRunId,
  markSeoCrawlRunFailedByProviderRunId,
  persistApifySeoResults,
} from "@/lib/db/seo-apify-pipeline";
import { enrichResultsWithAi } from "@/lib/seo/enrichResults";
import { normalizeEnrichedResults } from "@/lib/seo/normalizeApifyResults";

export const runtime = "nodejs";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function webhookSecretMatches(request: NextRequest): boolean {
  const configured = process.env.APIFY_WEBHOOK_SECRET?.trim();
  if (!configured) return true;
  const secret = request.nextUrl.searchParams.get("secret")?.trim();
  return secret === configured;
}

function resourceFromPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const root = payload as Record<string, unknown>;
  const nested = root.resource;
  return nested && typeof nested === "object" ? (nested as Record<string, unknown>) : root;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function fetchDatasetItems(datasetId: string, apiToken: string): Promise<unknown[]> {
  const url = new URL(`https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items`);
  url.searchParams.set("clean", "true");
  url.searchParams.set("token", apiToken);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`dataset_fetch_failed_${res.status}`);
  }
  const items = (await res.json()) as unknown;
  return Array.isArray(items) ? items : [];
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!webhookSecretMatches(request)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[seo-webhook] received Apify webhook");
  }

  const resource = resourceFromPayload(payload);
  const runId = str(resource.id);
  const status = (str(resource.status) ?? "").toUpperCase();
  const datasetId = str(resource.defaultDatasetId);

  if (!runId) {
    return json({ ok: false, error: "missing_run_id" }, 400);
  }

  const failedStatuses = new Set(["FAILED", "TIMED-OUT", "TIMED_OUT", "ABORTED"]);
  if (failedStatuses.has(status)) {
    await markSeoCrawlRunFailedByProviderRunId({
      providerRunId: runId,
      errorMessage: str(resource.statusMessage) ?? `Apify run ${status.toLowerCase() || "failed"}.`,
    });
    return json({ ok: true });
  }

  if (status !== "SUCCEEDED") {
    return json({ ok: true });
  }

  const apiToken = process.env.APIFY_API_TOKEN?.trim();
  if (!apiToken) {
    console.error("[seo-webhook] APIFY_API_TOKEN missing during succeeded webhook", { runId });
    return json({ ok: true });
  }
  if (!datasetId) {
    await markSeoCrawlRunFailedByProviderRunId({
      providerRunId: runId,
      errorMessage: "Apify webhook did not include a dataset ID.",
    });
    return json({ ok: true });
  }

  const crawlRun = await getSeoCrawlRunByProviderRunId(runId);
  if (!crawlRun) {
    console.error("[seo-webhook] no matching crawl run for Apify run", { runId });
    return json({ ok: true });
  }

  try {
    const items = await fetchDatasetItems(datasetId, apiToken);
    const enriched = await enrichResultsWithAi(items);
    const normalized = normalizeEnrichedResults(enriched);
    await persistApifySeoResults({
      crawlRunId: crawlRun.id,
      siteId: crawlRun.site_id,
      domain: crawlRun.domain ?? normalized.pages[0]?.url ?? "unknown",
      providerDatasetId: datasetId,
      results: normalized,
    });
  } catch (err) {
    console.error("[seo-webhook] failed to process Apify dataset", { runId, datasetId, err });
    await markSeoCrawlRunFailedByProviderRunId({
      providerRunId: runId,
      errorMessage: "Crawl finished, but importing the report failed.",
    }).catch(() => undefined);
  }

  return json({ ok: true });
}
