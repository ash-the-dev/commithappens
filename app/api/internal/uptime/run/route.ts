import { getActiveUptimeChecks, insertUptimeLog } from "@/lib/db/uptime";

export const runtime = "nodejs";

const REQUEST_TIMEOUT_MS = 10_000;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function isAuthorized(request: Request): boolean {
  const secret =
    process.env.UPTIME_RUNNER_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const header = request.headers.get("x-cron-secret")?.trim() ?? "";
  return bearer === secret || header === secret;
}

async function runCheck(url: string): Promise<{
  isUp: boolean;
  httpStatus: number | null;
  responseTimeMs: number;
  errorMessage: string | null;
}> {
  const started = Date.now();
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    return {
      isUp: res.status >= 200 && res.status < 400,
      httpStatus: res.status,
      responseTimeMs: Date.now() - started,
      errorMessage: null,
    };
  } catch (err) {
    clearTimeout(timeout);
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? "request_timeout"
          : err.message
        : "request_failed";
    return {
      isUp: false,
      httpStatus: null,
      responseTimeMs: Date.now() - started,
      errorMessage: message.slice(0, 1000),
    };
  }
}

async function run(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  try {
    const checks = await getActiveUptimeChecks();
    const checkedAt = new Date();

    let attempted = 0;
    let succeeded = 0;
    let failed = 0;
    let inserted = 0;
    let writeFailures = 0;

    for (const check of checks) {
      attempted += 1;
      const result = await runCheck(check.url);
      if (result.isUp) {
        succeeded += 1;
      } else {
        failed += 1;
      }

      try {
        await insertUptimeLog({
          websiteId: check.website_id,
          uptimeCheckId: check.uptime_check_id,
          checkedAt,
          httpStatus: result.httpStatus,
          responseTimeMs: result.responseTimeMs,
          isUp: result.isUp,
          errorMessage: result.errorMessage,
        });
        inserted += 1;
      } catch (err) {
        writeFailures += 1;
        console.error("[uptime-run] failed to insert log", {
          checkId: check.uptime_check_id,
          websiteId: check.website_id,
          err,
        });
      }
    }

    return json({
      ok: true,
      attempted,
      succeeded,
      failed,
      inserted,
      writeFailures,
    });
  } catch (err) {
    console.error("[uptime-run] batch failed", err);
    return json({ ok: false, error: "uptime_run_failed" }, 500);
  }
}

export async function GET(request: Request): Promise<Response> {
  return run(request);
}

export async function POST(request: Request): Promise<Response> {
  return run(request);
}
