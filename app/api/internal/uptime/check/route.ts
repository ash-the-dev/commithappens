import { getDueUptimeMonitors, recordUptimeCheck } from "@/lib/db/uptime";
import { createRunningScan, failScan } from "@/lib/db/scans";
import { runUptimeProbe } from "@/lib/uptime/probe";
import { urlFromSiteCandidate, validatePublicHttpUrl } from "@/lib/uptime/url-safety";

export const runtime = "nodejs";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.UPTIME_CRON_SECRET?.trim();
  if (!secret) return false;
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get("secret")?.trim();
  const headerSecret = request.headers.get("x-cron-secret")?.trim();
  return querySecret === secret || headerSecret === secret;
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  try {
    const monitors = await getDueUptimeMonitors();
    const checkedAt = new Date();
    let checked = 0;
    let up = 0;
    let down = 0;

    for (const monitor of monitors) {
      const scan = monitor.site_id
        ? await createRunningScan({
            siteId: monitor.site_id,
            scanType: "uptime",
            source: "uptime-cron",
            rawResult: { monitorId: monitor.id, url: monitor.url },
          })
        : null;
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
      const checkedUrl = safe.ok ? safe.url.toString() : candidate ?? monitor.url;

      await recordUptimeCheck({
        monitorId: monitor.id,
        scanId: scan?.id,
        userId: monitor.user_id,
        siteId: monitor.site_id,
        url: checkedUrl,
        checkedAt,
        statusCode: result.statusCode,
        responseTimeMs: result.responseTimeMs,
        isUp: result.isUp,
        errorMessage: result.errorMessage,
        frequencyMinutes: monitor.frequency_minutes,
      }).catch(async (err) => {
        if (scan) {
          await failScan({
            scanId: scan.id,
            errorMessage: "Uptime check failed while saving the result.",
            rawResult: { error: err instanceof Error ? err.message : String(err) },
          }).catch(() => undefined);
        }
        throw err;
      });

      checked += 1;
      if (result.isUp) {
        up += 1;
      } else {
        down += 1;
      }
    }

    return json({ ok: true, checked, up, down });
  } catch (err) {
    console.error("[uptime-check] batch failed", err);
    return json({ ok: false, error: "uptime_check_failed" }, 500);
  }
}
