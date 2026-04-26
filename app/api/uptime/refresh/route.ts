import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getBillingAccess } from "@/lib/billing/access";
import { getPlanMonitoringFrequency } from "@/lib/billing/plan-monitoring";
import { getWebsiteForUser } from "@/lib/db/websites";
import { getUptimeMonitorForWebsite, recordUptimeCheck } from "@/lib/db/uptime";
import { runUptimeProbe } from "@/lib/uptime/probe";
import { urlFromSiteCandidate, validatePublicHttpUrl } from "@/lib/uptime/url-safety";

export const runtime = "nodejs";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function retryAfterSeconds(nextCheckAt: string | null): number {
  if (!nextCheckAt) return 0;
  const next = new Date(nextCheckAt).getTime();
  if (!Number.isFinite(next)) return 0;
  return Math.max(0, Math.ceil((next - Date.now()) / 1000));
}

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let body: { siteId?: string; site_id?: string } = {};
  try {
    body = (await request.json()) as { siteId?: string; site_id?: string };
  } catch {
    body = {};
  }

  const siteId = body.siteId?.trim() || body.site_id?.trim();
  if (!siteId) {
    return json({ ok: false, error: "missing_site_id", message: "Missing site ID." }, 400);
  }

  const site = await getWebsiteForUser(siteId, session.user.id);
  if (!site) {
    return json({ ok: false, error: "site_not_found" }, 404);
  }

  const billing = await getBillingAccess(session.user.id, session.user.email);
  const allowedFrequency = getPlanMonitoringFrequency(billing.accountKind);
  const monitor = await getUptimeMonitorForWebsite(site.id);
  if (!monitor || !monitor.enabled) {
    return json(
      {
        ok: false,
        error: "monitor_not_enabled",
        message: "No active uptime monitor exists for this site yet.",
      },
      409,
    );
  }

  const retryAfterSec = retryAfterSeconds(monitor.next_check_at);
  if (retryAfterSec > 0) {
    return json(
      {
        ok: false,
        error: "too_early",
        message: `Uptime can refresh again in ${Math.ceil(retryAfterSec / 60)} minute(s). The interval leash is doing its job.`,
        retryAfterSec,
        nextCheckAt: monitor.next_check_at,
      },
      429,
    );
  }

  const candidate = urlFromSiteCandidate(monitor.url);
  const safe = candidate ? await validatePublicHttpUrl(candidate) : { ok: false as const, reason: "missing_url" };
  const result = safe.ok
    ? await runUptimeProbe(safe.url)
    : {
        statusCode: null,
        responseTimeMs: null,
        isUp: false,
        errorMessage: safe.reason,
      };
  const checkedAt = new Date();
  const checkedUrl = safe.ok ? safe.url.toString() : candidate ?? monitor.url;

  await recordUptimeCheck({
    monitorId: monitor.id,
    userId: monitor.user_id ?? session.user.id,
    siteId: monitor.site_id ?? site.id,
    url: checkedUrl,
    checkedAt,
    statusCode: result.statusCode,
    responseTimeMs: result.responseTimeMs,
    isUp: result.isUp,
    errorMessage: result.errorMessage,
    frequencyMinutes: Math.max(allowedFrequency, monitor.frequency_minutes),
  });

  return json({
    ok: true,
    checked: 1,
    up: result.isUp ? 1 : 0,
    down: result.isUp ? 0 : 1,
    statusCode: result.statusCode,
    responseTimeMs: result.responseTimeMs,
    errorMessage: result.errorMessage,
    checkedAt: checkedAt.toISOString(),
  });
}
