import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getWebsiteForUser } from "@/lib/db/websites";
import { getSeoCrawlRunHistory } from "@/lib/db/seo-crawl-intelligence";
import { getWebsiteUptimeHistory } from "@/lib/db/uptime";
import { buildSiteTrendsPayload } from "@/lib/dashboard/site-trends";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const websiteId = url.searchParams.get("website_id")?.trim();
  if (!websiteId) {
    return Response.json({ ok: false, error: "missing_website_id" }, { status: 400 });
  }
  const site = await getWebsiteForUser(websiteId, userId);
  if (!site) {
    return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const [crawls, uptimeLogs] = await Promise.all([
    getSeoCrawlRunHistory(websiteId, 18).catch(() => []),
    getWebsiteUptimeHistory(websiteId, 48).catch(() => []),
  ]);
  const payload = buildSiteTrendsPayload(crawls, uptimeLogs);
  return Response.json({ ok: true, trends: payload });
}
