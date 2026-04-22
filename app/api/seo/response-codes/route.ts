import { buildResponseCodeReportFromParseResult } from "@/lib/seo-reporting";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY?.trim();
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("[seo][response-codes] Missing Supabase env vars");
    return Response.json(buildResponseCodeReportFromParseResult(null));
  }

  const query = `${SUPABASE_URL}/rest/v1/response_code_reports?site_id=eq.default&order=created_at.desc&limit=1`;

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
      return Response.json(buildResponseCodeReportFromParseResult(null));
    }

    const rows = (await res.json()) as Array<{ report_json?: unknown }>;
    const report = rows[0]?.report_json;
    if (!report) {
      return Response.json(buildResponseCodeReportFromParseResult(null));
    }
    return Response.json(report);
  } catch (err) {
    console.error("[seo][response-codes] failed to fetch from Supabase", err);
    return Response.json(buildResponseCodeReportFromParseResult(null));
  }
}
