import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getBillingAccess } from "@/lib/billing/access";
import { canUseFeature } from "@/lib/entitlements";
import { getWebsiteForUser } from "@/lib/db/websites";
import { getWebsiteInsights } from "@/lib/db/insights";
import { getWebsiteThreatOverview } from "@/lib/db/threats";
import { generateSpikeExplanation } from "@/lib/ai/generate-spike-explanation";

export const runtime = "nodejs";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export async function GET(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const billing = await getBillingAccess(session.user.id, session.user.email);
  if (!canUseFeature(billing.accountKind, "dashboardIntelligence")) {
    return json({ ok: false, error: "upgrade_required" }, 403);
  }

  const url = new URL(request.url);
  const websiteId = url.searchParams.get("website_id")?.trim();
  if (!websiteId) {
    return json({ ok: false, error: "missing_website_id" }, 400);
  }

  const site = await getWebsiteForUser(websiteId, session.user.id);
  if (!site) {
    return json({ ok: false, error: "website_not_found" }, 404);
  }

  const threatOverview = await getWebsiteThreatOverview(site.id);
  const insights = await getWebsiteInsights(site.id, threatOverview);
  const anomaly = insights.anomalies[0] ?? null;
  if (!anomaly) {
    return json({ ok: true, explanation: null });
  }

  const explanation = await generateSpikeExplanation(site.id, anomaly.date, anomaly);
  return json({ ok: true, explanation });
}
