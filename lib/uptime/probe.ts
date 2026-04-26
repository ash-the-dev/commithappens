export const UPTIME_REQUEST_TIMEOUT_MS = 10_000;

export type UptimeProbeResult = {
  statusCode: number | null;
  responseTimeMs: number | null;
  isUp: boolean;
  errorMessage: string | null;
};

export async function runUptimeProbe(url: URL): Promise<UptimeProbeResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPTIME_REQUEST_TIMEOUT_MS);

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
