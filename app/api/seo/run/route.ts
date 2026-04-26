import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getBillingAccess } from "@/lib/billing/access";
import { getWebsiteForUser } from "@/lib/db/websites";
import { countSeoCrawlRunsForSiteSince } from "@/lib/db/seo-crawl-intelligence";
import {
  attachProviderRunToSeoCrawlRun,
  createPendingSeoCrawlRun,
  markSeoCrawlRunFailedById,
} from "@/lib/db/seo-apify-pipeline";
import { normalizePublicCrawlUrl, urlsBelongToSameSite } from "@/lib/seo/crawl-request-security";

export const runtime = "nodejs";

const WORKER_MISSING_MESSAGE =
  "SEO crawl worker not connected yet. Stored reports can refresh, but new crawls need the worker enabled.";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function webhookTarget(): string | null {
  const configured = process.env.SEO_CRAWL_WEBHOOK_URL?.trim();
  if (!configured) return null;
  const secret = process.env.APIFY_WEBHOOK_SECRET?.trim();
  if (!secret) return configured;
  const url = new URL(configured);
  url.searchParams.set("secret", secret);
  return url.toString();
}

function encodeWebhookParam(requestUrl: string): string {
  const payload = [
    {
      eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.TIMED_OUT", "ACTOR.RUN.ABORTED"],
      requestUrl,
    },
  ];
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

async function startApifyRun(input: {
  actorId: string;
  apiToken: string;
  domain: string;
  webhookUrl: string | null;
}): Promise<{ runId: string; datasetId: string | null }> {
  const url = new URL(`https://api.apify.com/v2/acts/${encodeURIComponent(input.actorId)}/runs`);
  url.searchParams.set("token", input.apiToken);
  if (input.webhookUrl) {
    url.searchParams.set("webhooks", encodeWebhookParam(input.webhookUrl));
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      startUrls: [{ url: input.domain }],
      maxCrawlDepth: 2,
      maxCrawlPages: 50,
      respectRobotsTxtFile: true,
      saveHtml: false,
      saveMarkdown: false,
      saveScreenshots: false,
    }),
  });
  const payload = (await res.json().catch(() => null)) as {
    data?: { id?: string; defaultDatasetId?: string };
    error?: { message?: string };
  } | null;

  if (!res.ok || !payload?.data?.id) {
    throw new Error(payload?.error?.message ?? `Apify run start failed (${res.status})`);
  }

  return {
    runId: payload.data.id,
    datasetId: payload.data.defaultDatasetId ?? null,
  };
}

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const billing = await getBillingAccess(session.user.id, session.user.email);
  if (!billing.seoEnabled) {
    return json(
      {
        ok: false,
        code: "UPGRADE_REQUIRED",
        message: "SEO crawling lives on the Committed plan. The bot has standards.",
      },
      403,
    );
  }

  const apiToken = process.env.APIFY_API_TOKEN?.trim();
  const actorId = process.env.APIFY_ACTOR_ID?.trim();
  if (!apiToken || !actorId) {
    return json(
      {
        ok: false,
        code: "SEO_WORKER_NOT_CONFIGURED",
        message: WORKER_MISSING_MESSAGE,
      },
      503,
    );
  }

  let body: { siteId?: string; site_id?: string; domain?: string } = {};
  try {
    body = (await request.json()) as { siteId?: string; site_id?: string; domain?: string };
  } catch {
    body = {};
  }

  const siteId = body.siteId?.trim() || body.site_id?.trim();
  if (!siteId) {
    return json({ ok: false, code: "MISSING_SITE_ID", message: "Missing site ID. The bot needs an address." }, 400);
  }

  const site = await getWebsiteForUser(siteId, session.user.id);
  if (!site) {
    return json({ ok: false, code: "WEBSITE_NOT_FOUND", message: "Website not found." }, 404);
  }

  let crawlUrl: URL;
  try {
    crawlUrl = normalizePublicCrawlUrl(body.domain?.trim() || `https://${site.primary_domain}`);
  } catch (err) {
    return json({ ok: false, code: "INVALID_DOMAIN", message: err instanceof Error ? err.message : "Invalid URL." }, 400);
  }

  if (!urlsBelongToSameSite(crawlUrl, site.primary_domain)) {
    return json(
      {
        ok: false,
        code: "DOMAIN_NOT_ALLOWED",
        message: "That URL does not belong to this site. Nice try, chaos goblin.",
      },
      400,
    );
  }

  if (billing.maxSeoCrawlsPerSitePerWeek != null) {
    const windowDays = billing.accountKind === "situationship" ? 30 : 7;
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const recentRuns = await countSeoCrawlRunsForSiteSince(site.id, since);
    if (recentRuns >= billing.maxSeoCrawlsPerSitePerWeek) {
      return json(
        {
          ok: false,
          code: billing.accountKind === "situationship" ? "MONTHLY_CRAWL_LIMIT_REACHED" : "WEEKLY_CRAWL_LIMIT_REACHED",
          message:
            billing.accountKind === "situationship"
              ? "Situationship includes one SEO crawl with AI recommendations each month. Tiny leash, still useful."
              : "Committed includes one SEO crawl with recommendations per site each week. All In keeps that weekly rhythm across more sites.",
        },
        429,
      );
    }
  }

  const pending = await createPendingSeoCrawlRun({
    userId: session.user.id,
    siteId: site.id,
    domain: crawlUrl.toString(),
    actorId,
  });

  try {
    const run = await startApifyRun({
      actorId,
      apiToken,
      domain: crawlUrl.toString(),
      webhookUrl: webhookTarget(),
    });
    await attachProviderRunToSeoCrawlRun({
      crawlRunId: pending.id,
      providerRunId: run.runId,
      providerDatasetId: run.datasetId,
    });
    return json({
      ok: true,
      message: "Crawl started. Results will update shortly.",
      crawlRunId: pending.id,
      providerRunId: run.runId,
    });
  } catch (err) {
    console.error("[seo-run] failed to start Apify actor", {
      siteId: site.id,
      crawlRunId: pending.id,
      err,
    });
    await markSeoCrawlRunFailedById({
      crawlRunId: pending.id,
      errorMessage: "Apify actor failed to start.",
    }).catch(() => undefined);
    return json(
      {
        ok: false,
        code: "SEO_CRAWL_START_FAILED",
        message: "Crawl failed to start. Try again in a minute, or check the worker connection.",
      },
      502,
    );
  }
}
