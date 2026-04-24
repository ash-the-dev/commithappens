/**
 * Shared client logic for POST /api/internal/seo/response-codes/run
 * (dashboard crawl + import). Used by the SEO console and the crawl snapshot section.
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
      : "Starting a full crawl from the browser isn’t available in the hosted app yet. This report still shows your last imported data.";
  }
  if (fromApi && !looksLikeServerTechnicalNoise(fromApi)) {
    return fromApi;
  }
  if (fromApi) {
    return "We couldn’t run the crawl. Try again later, or import results from your project checkout (npm run seo:run).";
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
 * Triggers the same server import as the SEO console "Run crawl" (npm run seo:run on the host).
 * Caller should call `router.refresh()` on success to reload RSC data (crawl run, top fixes, etc.).
 */
export async function runSeoResponseCodesImportFromDashboard(siteId: string): Promise<SeoDashboardCrawlRunResult> {
  const res = await fetch("/api/internal/seo/response-codes/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ site_id: siteId }),
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
    message: (typeof payload?.message === "string" && payload.message.trim()) || "Report refreshed",
  };
}
