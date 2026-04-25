import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getBillingAccess } from "@/lib/billing/access";
import { getPool } from "@/lib/db/pool";
import { getWebsiteForUser } from "@/lib/db/websites";
import {
  generateAiSeoRecommendations,
  type GenerateAiSeoRecommendationsInput,
  type SeoRecommendationPageInput,
} from "@/lib/seo/aiRecommendations";
import { DEFAULT_SEO_KEYWORD_CONTEXT } from "@/lib/seo/keyword-context";

export const runtime = "nodejs";

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

export async function GET(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const billing = await getBillingAccess(session.user.id, session.user.email);
  if (!billing.canUseSEO || !billing.canUseIntelligence) {
    return json(
      {
        ok: false,
        error: "upgrade_required",
        message: "AI SEO recommendations are available on paid SEO plans.",
      },
      403,
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
  const latestRun = await pool.query<{ id: string; created_at: string }>(
    `SELECT id, created_at::text
     FROM seo_crawl_runs
     WHERE site_id = $1::text
     ORDER BY created_at DESC
     LIMIT 1`,
    [siteId],
  );
  const run = latestRun.rows[0];
  if (!run) {
    const result = await generateAiSeoRecommendations({
      siteUrl: site.primary_domain,
      pages: [],
      keywordContext: DEFAULT_SEO_KEYWORD_CONTEXT,
    });
    return json({
      ok: true,
      runCreatedAt: null,
      keywordContext: DEFAULT_SEO_KEYWORD_CONTEXT,
      ...result,
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
       WHERE site_id = $1::text
       ORDER BY created_at DESC
       LIMIT 1`,
      [siteId],
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
    keywordContext: DEFAULT_SEO_KEYWORD_CONTEXT,
  };

  const result = await generateAiSeoRecommendations(payload);
  return json({
    ok: true,
    runCreatedAt: run.created_at,
    keywordContext: DEFAULT_SEO_KEYWORD_CONTEXT,
    ...result,
  });
}
