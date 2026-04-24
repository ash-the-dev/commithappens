import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getBillingAccess } from "@/lib/billing/access";
import { getWebsiteForUser } from "@/lib/db/websites";
import { getPool } from "@/lib/db/pool";
import { buildResponseCodeReportFromParseResult } from "@/lib/seo-reporting";
import { buildResponseCodeComparison } from "@/lib/seo/report";
import type { ResponseCodeReport } from "@/lib/seo/response-codes";

export const runtime = "nodejs";

type BuiltReportLike = {
  raw: unknown;
  insights: unknown;
  voice: unknown;
};

function isBuiltReportLike(value: unknown): value is BuiltReportLike {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.raw !== null &&
    typeof candidate.raw === "object" &&
    candidate.insights !== null &&
    typeof candidate.insights === "object" &&
    candidate.voice !== null &&
    typeof candidate.voice === "object"
  );
}

function coerceReport(value: unknown): ResponseCodeReport {
  if (value == null) {
    return buildResponseCodeReportFromParseResult(null);
  }
  if (isBuiltReportLike(value)) {
    return value as ResponseCodeReport;
  }
  return buildResponseCodeReportFromParseResult(value);
}

function resolveSiteId(request: Request): string {
  const url = new URL(request.url);
  return (
    url.searchParams.get("site_id")?.trim() ||
    process.env.SEO_SITE_ID?.trim() ||
    process.env.SEO_REPORT_SITE_ID?.trim() ||
    "default"
  );
}

export async function GET(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const billing = await getBillingAccess(userId, session.user.email);
  if (!billing.seoEnabled) {
    return Response.json(
      { ok: false, error: "upgrade_required", message: "SEO report access is on the Committed plan." },
      { status: 403 },
    );
  }

  const siteId = resolveSiteId(request);
  const site = await getWebsiteForUser(siteId, userId);
  if (!site) {
    return Response.json({ ok: false, error: "website_not_found" }, { status: 404 });
  }

  try {
    const pool = getPool();
    const result = await pool.query<{ report_json: unknown; created_at: string }>(
      `SELECT report_json, created_at::text
       FROM response_code_reports
       WHERE site_id = $1::text
       ORDER BY created_at DESC
       LIMIT 2`,
      [siteId],
    );
    const rows = result.rows;
    const current = coerceReport(rows[0]?.report_json ?? null);
    const previous = rows[1]?.report_json
      ? coerceReport(rows[1].report_json)
      : null;

    const comparison = buildResponseCodeComparison({
      current,
      previous,
      currentCreatedAt: rows[0]?.created_at ?? null,
      previousCreatedAt: rows[1]?.created_at ?? null,
    });

    // Keep backward compatibility: old consumers can still read raw/insights/voice at top level.
    return Response.json({
      current,
      previous,
      comparison,
      ...current,
    });
  } catch (err) {
    console.error("[seo][response-codes] failed to fetch from Supabase", err);
    const fallback = buildResponseCodeReportFromParseResult(null);
    return Response.json({
      current: fallback,
      previous: null,
      comparison: buildResponseCodeComparison({ current: fallback, previous: null }),
      ...fallback,
    });
  }
}
