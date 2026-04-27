"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SeoRecommendation = {
  id: string;
  type: string;
  pageUrl: string;
  severity: "critical" | "high" | "medium" | "low";
  priority: number;
  title: string;
  problem: string;
  currentValue?: string | null;
  suggestedFix: string;
  suggestedText?: string | null;
  placement?: string | null;
  whyItMatters: string;
  estimatedImpact?: string | null;
  effort?: "quick" | "medium" | "larger";
  copyable?: boolean;
};

type ApiPayload = {
  ok?: boolean;
  source?: "ai" | "fallback";
  model?: string | null;
  generatedAt?: string;
  crawlRunId?: string | null;
  runCreatedAt?: string | null;
  recommendations?: SeoRecommendation[];
  summary?: string;
  sections?: Array<{ title: string; body: string }>;
  checklist?: string[];
  priority?: "critical" | "high" | "medium" | "low" | "none";
  confidence?: "stored data" | "early signal" | "needs more data";
  basedOn?: string[];
  keywordContext?: {
    primaryKeywords: string[];
    supportingKeywords: string[];
    avoidKeywords?: string[];
  };
  error?: string;
  message?: string;
};

type Props = {
  siteId: string;
  crawlRunId?: string | null;
};

const FRESH_RESPONSE_MS = 5 * 60 * 1000;
const cachedPayloads = new Map<string, { payload: ApiPayload; fetchedAt: number }>();
const inFlightRequests = new Map<string, Promise<ApiPayload>>();

function severityClass(severity: SeoRecommendation["severity"]): string {
  if (severity === "critical") return "border-amber-300 bg-amber-50 text-amber-800";
  if (severity === "high") return "border-pink-300 bg-pink-50 text-pink-800";
  if (severity === "medium") return "border-violet-300 bg-violet-50 text-violet-800";
  return "border-blue-300 bg-blue-50 text-blue-800";
}

function guideSteps(rec: SeoRecommendation): string[] {
  return [
    `Open the page shown above in your site editor or CMS.`,
    rec.placement
      ? `Find this spot: ${rec.placement}`
      : "Find the page setting or content area related to the problem.",
    rec.suggestedText
      ? `Paste or type this exact text: "${rec.suggestedText}"`
      : rec.suggestedFix,
    "Save or publish the page, then run SEO Crawl again so Commit Happens can confirm the fix.",
  ];
}

export function AiSeoRecommendationsCard({ siteId, crawlRunId = null }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [payload, setPayload] = useState<ApiPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async (force = false) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setError(null);
    try {
      const cacheKey = `${siteId}:${crawlRunId ?? "no-crawl"}`;
      const cached = cachedPayloads.get(cacheKey);
      if (!force && cached && Date.now() - cached.fetchedAt < FRESH_RESPONSE_MS) {
        setPayload(cached.payload);
        setIsLoading(false);
        return;
      }

      let request = !force ? inFlightRequests.get(cacheKey) : null;
      if (!request) {
        request = fetch(`/api/seo/recommendations?site_id=${encodeURIComponent(siteId)}`, {
          method: "GET",
        }).then(async (res) => {
          const data = (await res.json()) as ApiPayload;
          if (!res.ok || data.ok === false) {
            throw new Error(data.message || data.error || "AI recommendations didn’t load. The robot intern tripped.");
          }
          cachedPayloads.set(cacheKey, { payload: data, fetchedAt: Date.now() });
          return data;
        });
        inFlightRequests.set(cacheKey, request);
        void request.then(
          () => {
            if (inFlightRequests.get(cacheKey) === request) {
              inFlightRequests.delete(cacheKey);
            }
          },
          () => {
            if (inFlightRequests.get(cacheKey) === request) {
              inFlightRequests.delete(cacheKey);
            }
          },
        );
      }
      const data = await request;
      if (requestIdRef.current !== requestId) return;
      setPayload(data);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      setError(err instanceof Error ? err.message : "AI recommendations didn’t load. The robot intern tripped.");
      const cached = cachedPayloads.get(`${siteId}:${crawlRunId ?? "no-crawl"}`);
      setPayload(cached?.payload ?? null);
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [siteId, crawlRunId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const copyText = useCallback(async (rec: SeoRecommendation) => {
    if (!rec.suggestedText) return;
    try {
      await navigator.clipboard.writeText(rec.suggestedText);
      setCopiedId(rec.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setCopiedId(null);
    }
  }, []);

  const recommendations = payload?.recommendations ?? [];
  const noCrawlData = payload?.error === "no_crawl_data";
  const topRecommendation = recommendations[0] ?? null;
  const biggestOpportunity =
    recommendations.find((rec) => rec.type === "missing_meta_description" || rec.type === "missing_h1" || rec.type === "missing_title") ??
    topRecommendation;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.55)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">AI Recommendations</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">What to fix next</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            You’re not in trouble, but you’re leaving easy wins on the table. These are crawl-backed fixes, ranked by
            impact.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50/70 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            {payload?.source === "ai" ? "AI layer" : "Fallback"}
          </span>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={isLoading}
            className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800 transition hover:bg-violet-100 disabled:opacity-60"
          >
            {isLoading ? "Thinking..." : "Refresh"}
          </button>
        </div>
      </div>

      {payload?.summary ? (
        <p className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/70 p-3 text-sm text-slate-700">
          {payload.summary}
        </p>
      ) : null}

      {topRecommendation ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <p className="rounded-2xl border border-violet-200 bg-violet-50/80 p-3 text-sm text-slate-800">
            <span className="block text-xs font-black uppercase tracking-[0.14em] text-violet-700">
              If you only fix one thing today
            </span>
            {topRecommendation.title}
          </p>
          <p className="rounded-2xl border border-blue-200 bg-blue-50/80 p-3 text-sm text-slate-800">
            <span className="block text-xs font-black uppercase tracking-[0.14em] text-blue-700">
              Biggest opportunity
            </span>
            {biggestOpportunity?.estimatedImpact ?? biggestOpportunity?.whyItMatters ?? "Clarify the pages search engines already found."}
          </p>
        </div>
      ) : null}

      {payload?.keywordContext ? (
        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
                Keyword + wording context
              </p>
              <p className="mt-1 text-sm text-slate-700">
                Recommendations use this as strategy, not keyword stuffing. We are classy gremlins.
              </p>
            </div>
            <span className="rounded-full border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-700">
              AI guidance
            </span>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-[0.7rem] font-bold uppercase tracking-wide text-slate-500">Primary</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {payload.keywordContext.primaryKeywords.map((keyword) => (
                  <span key={keyword} className="rounded-full border border-white bg-white px-2 py-1 text-xs text-slate-700">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[0.7rem] font-bold uppercase tracking-wide text-slate-500">Supporting</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {payload.keywordContext.supportingKeywords.map((keyword) => (
                  <span key={keyword} className="rounded-full border border-white bg-white px-2 py-1 text-xs text-slate-700">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</p>
      ) : null}

      {isLoading ? (
        <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
          <p className="text-sm font-semibold text-slate-950">Reading the room...</p>
          <p className="mt-1 text-sm text-slate-700">
            Using the latest saved crawl while the AI layer builds your plain-English fix list.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[0, 1].map((idx) => (
              <div key={idx} className="h-32 animate-pulse rounded-2xl border border-violet-100 bg-white/70" />
            ))}
          </div>
        </div>
      ) : recommendations.length === 0 && !error ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
          {noCrawlData
            ? "No crawl report data is available yet. Run SEO Crawl from the SEO controls, wait for it to save, then refresh this card."
            : "Nothing smart to say yet. Run a crawl with titles, meta descriptions, H1s, status codes, and links, then make the AI earn rent."}
        </div>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {recommendations.map((rec) => {
            const isExpanded = expandedId === rec.id;
            return (
              <article key={rec.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                        Priority {rec.priority}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${severityClass(rec.severity)}`}>
                        {rec.severity}
                      </span>
                      {rec.effort ? (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                          {rec.effort}
                        </span>
                      ) : null}
                    </div>
                    <h4 className="mt-3 text-base font-semibold text-slate-950">{rec.title}</h4>
                    <p className="mt-1 break-all font-mono text-xs text-slate-500">{rec.pageUrl}</p>
                  </div>
                  {rec.suggestedText ? (
                    <button
                      type="button"
                      onClick={() => void copyText(rec)}
                      className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 transition hover:bg-violet-100"
                    >
                      {copiedId === rec.id ? "Copied" : "Copy Fix"}
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  <p>
                    <span className="font-semibold text-slate-950">Problem:</span> {rec.problem}
                  </p>
                  {rec.currentValue ? (
                    <p>
                      <span className="font-semibold text-slate-950">Current:</span> {rec.currentValue}
                    </p>
                  ) : null}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="font-semibold text-slate-950">Suggested fix</p>
                    <p className="mt-1">{rec.suggestedFix}</p>
                    {rec.suggestedText ? (
                      <p className="mt-2 rounded-lg border border-white bg-white p-2 font-medium text-slate-950">
                        {rec.suggestedText}
                      </p>
                    ) : null}
                  </div>
                  {rec.placement ? (
                    <p>
                      <span className="font-semibold text-slate-950">Where:</span> {rec.placement}
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                  className="mt-4 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700 transition hover:bg-violet-100"
                >
                  {isExpanded ? "Hide guide" : "Guide me"}
                </button>
                {isExpanded ? (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <p><span className="font-semibold text-slate-950">Why it matters:</span> {rec.whyItMatters}</p>
                    {rec.estimatedImpact ? <p className="mt-2">{rec.estimatedImpact}</p> : null}
                    <div className="mt-3">
                      <p className="font-semibold text-slate-950">How to fix it:</p>
                      <ol className="mt-2 list-decimal space-y-1 pl-5">
                        {guideSteps(rec).map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
