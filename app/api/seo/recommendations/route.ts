import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getBillingAccess } from "@/lib/billing/access";
import { getPool } from "@/lib/db/pool";
import { getWebsiteForUser } from "@/lib/db/websites";
import { getLatestSeoCrawlRun } from "@/lib/db/seo-crawl-intelligence";
import { getPlanEntitlements, requireFeature } from "@/lib/entitlements";
import {
  generateAiSeoRecommendations,
  type AiSeoRecommendationsResult,
  type GenerateAiSeoRecommendationsInput,
  type SeoRecommendationPageInput,
} from "@/lib/seo/aiRecommendations";
import { buildSiteKeywordContext } from "@/lib/seo/keyword-context";

export const runtime = "nodejs";

const inFlightRecommendations = new Map<string, Promise<AiSeoRecommendationsResult>>();

type CrawlPageRow = {
  url: string;
  status: string | null;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
  links: unknown;
  issue_type: string | null;
  issue_severity: string | null;
  crawl_notes: string | null;
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function normalizePath(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}` || "/";
  } catch {
    return url || "/";
  }
}

function linkCount(links: unknown): number | null {
  if (!Array.isArray(links)) return null;
  return links.length;
}

function brokenLinkTargets(links: unknown): string[] {
  if (!Array.isArray(links)) return [];
  return links
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const status = typeof row.status === "number" ? row.status : Number(row.statusCode ?? row.status);
      const href = typeof row.href === "string" ? row.href : typeof row.url === "string" ? row.url : null;
      if (!href || !Number.isFinite(status) || status < 400) return null;
      return href;
    })
    .filter((href): href is string => href != null)
    .slice(0, 5);
}

function severityRank(severity: string | null): number {
  if (severity === "critical") return 1;
  if (severity === "warning") return 2;
  if (severity === "notice") return 3;
  return 4;
}

function compactReport(report: unknown): unknown {
  if (!report || typeof report !== "object") return null;
  const row = report as Record<string, unknown>;
  const raw = row.raw && typeof row.raw === "object" ? (row.raw as Record<string, unknown>) : null;
  const insights =
    row.insights && typeof row.insights === "object" ? (row.insights as Record<string, unknown>) : null;
  return {
    summary: raw?.summary ?? null,
    overview: insights?.overview ?? null,
    recommendations: Array.isArray(insights?.recommendations)
      ? insights.recommendations.slice(0, 8)
      : [],
  };
}

function crawlCadenceNote(planLabel: string): string {
  if (planLabel === "Situationship") {
    return "Since your plan only includes one crawl this month, fix these first before spending the next crawl.";
  }
  if (planLabel === "Committed") {
    return "Since your plan includes one crawl per week per site, batch these fixes before your next crawl.";
  }
  if (planLabel === "All In") {
    return "Since your plan includes one crawl per site per 24 hours, fix the highest-impact items before using the next crawl.";
  }
  return "SEO crawl guidance is based on the crawl cadence available for this plan.";
}

export async function GET(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const billing = await getBillingAccess(session.user.id, session.user.email);
  const seoAccess = requireFeature(billing.accountKind, "seoCrawl");
  const aiAccess = requireFeature(billing.accountKind, "aiInsights");
  const plan = getPlanEntitlements(billing.accountKind);
  if (!seoAccess.ok) {
    return json(
      {
        ok: false,
        error: "upgrade_required",
        message: seoAccess.message,
      },
      seoAccess.status,
    );
  }
  if (!aiAccess.ok) {
    return json(
      {
        ok: false,
        error: "upgrade_required",
        message: aiAccess.message,
      },
      aiAccess.status,
    );
  }

  const url = new URL(request.url);
  const siteId = url.searchParams.get("site_id")?.trim();
  if (!siteId) {
    return json({ ok: false, error: "missing_site_id" }, 400);
  }

  const site = await getWebsiteForUser(siteId, session.user.id);
  if (!site) {
    return json({ ok: false, error: "website_not_found" }, 404);
  }

  const pool = getPool();
  const keywordContext = buildSiteKeywordContext({
    name: site.name,
    primaryDomain: site.primary_domain,
  });
  const run = await getLatestSeoCrawlRun(siteId);
  const emptyResult = {
    source: "fallback" as const,
    model: null,
    generatedAt: new Date().toISOString(),
    recommendations: [],
    summary:
      "I don’t have a clean crawl for this site yet. Run SEO Crawl and I’ll have actual page-level advice instead of throwing glitter at guesses.",
    sections: [
      {
        title: "What I’m seeing",
        body: "No valid crawl-backed page data is available for recommendations yet.",
      },
      {
        title: "What to do next",
        body: "Run SEO Crawl once. After it saves page data, recommendations will use the saved crawl instead of live guessing.",
      },
    ],
    checklist: ["Run SEO Crawl.", "Fix the highest-priority pages first.", "Use the next crawl to verify meaningful edits."],
    priority: "none" as const,
    confidence: "needs more data" as const,
    basedOn: ["No latest valid SEO crawl run was available for this site."],
    error: "no_crawl_data",
  };
  if (!run) {
    return json({
      ok: true,
      crawlRunId: null,
      runCreatedAt: null,
      keywordContext,
      ...emptyResult,
    });
  }

  const [pagesResult, reportResult] = await Promise.all([
    pool.query<CrawlPageRow>(
      `SELECT url, status::text, title, meta_description, h1, links, issue_type, issue_severity, crawl_notes
       FROM seo_crawl_pages
       WHERE crawl_run_id = $1::uuid
       ORDER BY
         CASE issue_severity
           WHEN 'critical' THEN 1
           WHEN 'warning' THEN 2
           WHEN 'notice' THEN 3
           ELSE 4
         END,
         CASE
           WHEN coalesce(nullif(trim(h1), ''), '') = '' THEN 1
           WHEN coalesce(nullif(trim(title), ''), '') = '' THEN 2
           WHEN coalesce(nullif(trim(meta_description), ''), '') = '' THEN 3
           ELSE 4
         END,
         url
       LIMIT 30`,
      [run.id],
    ),
    pool.query<{ report_json: unknown }>(
      `SELECT report_json
       FROM response_code_reports
       WHERE crawl_run_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 1`,
      [run.id],
    ),
  ]);

  const pages: SeoRecommendationPageInput[] = pagesResult.rows
    .sort((a, b) => severityRank(a.issue_severity) - severityRank(b.issue_severity))
    .slice(0, 25)
    .map((page) => ({
      url: page.url,
      path: normalizePath(page.url),
      status: page.status != null && page.status !== "" ? Number(page.status) : null,
      title: page.title,
      metaDescription: page.meta_description,
      h1: page.h1,
      issueType: page.issue_type,
      issueSeverity: page.issue_severity,
      crawlNotes: page.crawl_notes,
      internalLinksCount: linkCount(page.links),
      brokenLinkTargets: brokenLinkTargets(page.links),
    }));
  if (pages.length === 0) {
    return json({
      ok: true,
      crawlRunId: run.id,
      runCreatedAt: run.created_at,
      keywordContext,
      ...emptyResult,
    });
  }

  const payload: GenerateAiSeoRecommendationsInput = {
    siteUrl: site.primary_domain,
    pages,
    responseCodeReport: compactReport(reportResult.rows[0]?.report_json ?? null),
    titleReport: {
      missing: pages.filter((p) => !p.title?.trim()).length,
      present: pages.filter((p) => p.title?.trim()).length,
    },
    metaDescriptionReport: {
      missing: pages.filter((p) => !p.metaDescription?.trim()).length,
      present: pages.filter((p) => p.metaDescription?.trim()).length,
    },
    h1Report: {
      missing: pages.filter((p) => !p.h1?.trim()).length,
      present: pages.filter((p) => p.h1?.trim()).length,
    },
    internalLinkReport: {
      pagesWithCounts: pages.filter((p) => p.internalLinksCount != null).length,
      lowInternalLinks: pages.filter((p) => (p.internalLinksCount ?? 99) < 2).length,
      brokenLinkTargets: pages.flatMap((p) => p.brokenLinkTargets).slice(0, 20),
    },
    keywordContext,
    planLabel: plan.label,
    crawlCadenceNote: crawlCadenceNote(plan.label),
  };

  const requestKey = `${siteId}:${run.id}`;
  let pending = inFlightRecommendations.get(requestKey);
  if (!pending) {
    pending = generateAiSeoRecommendations(payload);
    inFlightRecommendations.set(requestKey, pending);
    void pending.then(
      () => {
        if (inFlightRecommendations.get(requestKey) === pending) {
          inFlightRecommendations.delete(requestKey);
        }
      },
      () => {
        if (inFlightRecommendations.get(requestKey) === pending) {
          inFlightRecommendations.delete(requestKey);
        }
      },
    );
  }
  const result = await pending;
  return json({
    ok: true,
    crawlRunId: run.id,
    runCreatedAt: run.created_at,
    keywordContext,
    ...result,
  });
}
