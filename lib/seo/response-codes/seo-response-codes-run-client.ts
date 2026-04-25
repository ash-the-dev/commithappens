/**
 * Shared client logic for starting the Apify SEO crawl from dashboard surfaces.
 */

export type SeoResponseCodesRunPayload = {
  ok?: boolean;
  message?: string;
  error?: string;
};

function looksLikeServerTechnicalNoise(text: string): boolean {
  return /npm error|enoent|\/var\/task|sbx_user|package\.json|child_process|syscall open/i.test(text);
}

/**
 * User-safe message for a failed or rejected crawl run (never show raw stderr).
 */
export function userFacingSeoCrawlRunError(
  res: Response,
  payload: SeoResponseCodesRunPayload | null,
  rawBody: string,
): string {
  const fromApi = typeof payload?.message === "string" ? payload.message.trim() : "";
  if (res.status === 403) {
    return fromApi && !looksLikeServerTechnicalNoise(fromApi)
      ? fromApi
      : "SEO crawling is part of the Committed plan. Upgrade to run full crawls from the dashboard.";
  }
  if (res.status === 401) {
    return fromApi || "Sign in again to continue.";
  }
  if (res.status === 501) {
    return fromApi && !looksLikeServerTechnicalNoise(fromApi)
      ? fromApi
      : "SEO crawl worker not connected yet. Stored reports can refresh, but new crawls need the worker enabled.";
  }
  if (fromApi && !looksLikeServerTechnicalNoise(fromApi)) {
    return fromApi;
  }
  if (fromApi) {
    return "We couldn’t start the crawl. Try again later, or check the worker connection.";
  }
  if (looksLikeServerTechnicalNoise(rawBody)) {
    return "We couldn’t run the crawl. Try again later.";
  }
  return "We couldn’t run the crawl. Try again in a moment.";
}

export type SeoDashboardCrawlRunResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Starts the background Apify crawl. Results arrive later through the webhook.
 */
export async function runSeoResponseCodesImportFromDashboard(siteId: string): Promise<SeoDashboardCrawlRunResult> {
  const res = await fetch("/api/seo/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ siteId }),
  });
  const rawBody = await res.text();
  const payload: SeoResponseCodesRunPayload | null = (() => {
    try {
      return rawBody ? (JSON.parse(rawBody) as SeoResponseCodesRunPayload) : null;
    } catch {
      return null;
    }
  })();
  if (!res.ok) {
    return { ok: false, error: userFacingSeoCrawlRunError(res, payload, rawBody) };
  }
  if (payload && payload.ok === false) {
    return { ok: false, error: userFacingSeoCrawlRunError(res, payload, rawBody) };
  }
  return {
    ok: true,
    message:
      (typeof payload?.message === "string" && payload.message.trim()) ||
      "Crawl started. Results will update shortly.",
  };
}
