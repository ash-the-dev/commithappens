import { getDueUptimeMonitors, recordUptimeCheck } from "@/lib/db/uptime";
import { urlFromSiteCandidate, validatePublicHttpUrl } from "@/lib/uptime/url-safety";

export const runtime = "nodejs";

const REQUEST_TIMEOUT_MS = 10_000;

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

async function runProbe(url: URL): Promise<{
  statusCode: number | null;
  responseTimeMs: number | null;
  isUp: boolean;
  errorMessage: string | null;
}> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent": "CommitHappens-Uptime/1.0 (+https://www.commithappens.com)",
      },
    });
    clearTimeout(timeout);
    return {
      statusCode: response.status,
      responseTimeMs: Date.now() - startedAt,
      isUp: response.status >= 200 && response.status <= 399,
      errorMessage: null,
    };
  } catch (err) {
    clearTimeout(timeout);
    return {
      statusCode: null,
      responseTimeMs: Date.now() - startedAt,
      isUp: false,
      errorMessage:
        err instanceof Error
          ? (err.name === "AbortError" ? "request_timeout" : err.message).slice(0, 1000)
          : "request_failed",
    };
  }
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
      const candidate = urlFromSiteCandidate(monitor.url);
      const safe = candidate ? await validatePublicHttpUrl(candidate) : { ok: false as const, reason: "missing_url" };
      const result = safe.ok
        ? await runProbe(safe.url)
        : {
            statusCode: null,
            responseTimeMs: null,
            isUp: false,
            errorMessage: safe.reason,
          };
      const checkedUrl = safe.ok ? safe.url.toString() : candidate ?? monitor.url;

      await recordUptimeCheck({
        monitorId: monitor.id,
        userId: monitor.user_id,
        siteId: monitor.site_id,
        url: checkedUrl,
        checkedAt,
        statusCode: result.statusCode,
        responseTimeMs: result.responseTimeMs,
        isUp: result.isUp,
        errorMessage: result.errorMessage,
        frequencyMinutes: monitor.frequency_minutes,
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
