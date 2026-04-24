import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getBillingAccess } from "@/lib/billing/access";
import { getWebsiteForUser } from "@/lib/db/websites";
import { buildResponseCodeReportFromParseResult } from "@/lib/seo-reporting";
import { buildResponseCodeComparison } from "@/lib/seo/report";

export const runtime = "nodejs";

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

  const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY?.trim();
  const siteId = resolveSiteId(request);
  const site = await getWebsiteForUser(siteId, userId);
  if (!site) {
    return Response.json({ ok: false, error: "website_not_found" }, { status: 404 });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("[seo][response-codes] Missing Supabase env vars");
    return Response.json(buildResponseCodeReportFromParseResult(null));
  }

  const query = `${SUPABASE_URL}/rest/v1/response_code_reports?site_id=eq.${encodeURIComponent(siteId)}&order=created_at.desc&limit=2`;

  try {
    const res = await fetch(query, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(
        "[seo][response-codes] Supabase query failed",
        res.status,
        await res.text(),
      );
      const fallback = buildResponseCodeReportFromParseResult(null);
      return Response.json({
        current: fallback,
        previous: null,
        comparison: buildResponseCodeComparison({ current: fallback, previous: null }),
        ...fallback,
      });
    }

    const rows = (await res.json()) as Array<{ report_json?: unknown; created_at?: string }>;
    const current = buildResponseCodeReportFromParseResult(rows[0]?.report_json ?? null);
    const previous = rows[1]?.report_json
      ? buildResponseCodeReportFromParseResult(rows[1].report_json)
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
