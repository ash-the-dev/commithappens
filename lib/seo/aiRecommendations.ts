import "server-only";
import { getFastAiModel } from "@/lib/ai/models";
import { getOpenAiClient, isOpenAiConfigured } from "@/lib/ai/client";
import type { SeoKeywordContext } from "@/lib/seo/keyword-context";
import { normalizeKeywordContext } from "@/lib/seo/keyword-context";
import {
  buildPatternResponse,
  buildSuggestedWording,
  formatSuggestedWording,
} from "@/services/aiResponsePatterns";

export type SeoRecommendation = {
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

export type SeoRecommendationPageInput = {
  url: string;
  path: string;
  status: number | null;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  issueType: string | null;
  issueSeverity: string | null;
  crawlNotes: string | null;
  internalLinksCount: number | null;
  brokenLinkTargets: string[];
};

export type GenerateAiSeoRecommendationsInput = {
  siteUrl: string;
  pages: SeoRecommendationPageInput[];
  responseCodeReport?: unknown;
  titleReport?: unknown;
  metaDescriptionReport?: unknown;
  h1Report?: unknown;
  internalLinkReport?: unknown;
  keywordContext?: SeoKeywordContext | null;
  planLabel?: string;
  crawlCadenceNote?: string | null;
};

export type AiSeoRecommendationsResult = {
  source: "ai" | "fallback";
  model: string | null;
  generatedAt: string;
  recommendations: SeoRecommendation[];
  summary: string;
  sections?: Array<{ title: string; body: string }>;
  checklist?: string[];
  priority?: "critical" | "high" | "medium" | "low" | "none";
  confidence?: "stored data" | "early signal" | "needs more data";
  basedOn?: string[];
  error?: string;
};

const MAX_RECOMMENDATIONS = 10;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MODEL_TIMEOUT_MS = 6_000;
const cache = new Map<string, { expiresAt: number; value: AiSeoRecommendationsResult }>();

const SEO_RECOMMENDATIONS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    recommendations: {
      type: "array",
      minItems: 0,
      maxItems: MAX_RECOMMENDATIONS,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", minLength: 4, maxLength: 80 },
          type: { type: "string", minLength: 3, maxLength: 80 },
          pageUrl: { type: "string", minLength: 1, maxLength: 500 },
          severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
          priority: { type: "integer", minimum: 1, maximum: 20 },
          title: { type: "string", minLength: 8, maxLength: 160 },
          problem: { type: "string", minLength: 12, maxLength: 500 },
          currentValue: { type: ["string", "null"], maxLength: 500 },
          suggestedFix: { type: "string", minLength: 12, maxLength: 700 },
          suggestedText: { type: ["string", "null"], maxLength: 320 },
          placement: { type: ["string", "null"], maxLength: 350 },
          whyItMatters: { type: "string", minLength: 12, maxLength: 500 },
          estimatedImpact: { type: ["string", "null"], maxLength: 350 },
          effort: { type: "string", enum: ["quick", "medium", "larger"] },
          copyable: { type: "boolean" },
        },
        required: [
          "id",
          "type",
          "pageUrl",
          "severity",
          "priority",
          "title",
          "problem",
          "currentValue",
          "suggestedFix",
          "suggestedText",
          "placement",
          "whyItMatters",
          "estimatedImpact",
          "effort",
          "copyable",
        ],
      },
    },
    summary: { type: "string", minLength: 10, maxLength: 300 },
  },
  required: ["recommendations", "summary"],
} as const;

function normalizePath(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}` || "/";
  } catch {
    return url || "/";
  }
}

function stableId(type: string, pageUrl: string, priority: number): string {
  const raw = `${type}:${pageUrl}:${priority}`.toLowerCase();
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return `rec_${hash.toString(36)}`;
}

function severityFromPage(page: SeoRecommendationPageInput): SeoRecommendation["severity"] {
  if (page.issueSeverity === "critical" || (page.status != null && page.status >= 500)) return "critical";
  if (page.issueSeverity === "warning" || (page.status != null && page.status >= 400)) return "high";
  if (page.issueSeverity === "notice") return "medium";
  return "low";
}

function pageTopic(page: SeoRecommendationPageInput): string {
  const fromTitle = page.title?.replace(/\s+/g, " ").trim();
  if (fromTitle) return fromTitle.replace(/\s*[|·-]\s*.*$/, "").slice(0, 80);
  const last = normalizePath(page.url)
    .split("/")
    .filter(Boolean)
    .pop();
  if (!last) return "This Page";
  return last
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .slice(0, 80);
}

function issueCount(input: GenerateAiSeoRecommendationsInput, type: string): number {
  if (type === "missing_meta_description") return input.pages.filter((p) => !p.metaDescription?.trim() || p.issueType === type).length;
  if (type === "missing_title") return input.pages.filter((p) => !p.title?.trim() || p.issueType === type).length;
  if (type === "missing_h1") return input.pages.filter((p) => !p.h1?.trim() || p.issueType === type).length;
  if (type === "broken_page") return input.pages.filter((p) => p.status != null && p.status >= 400).length;
  return input.pages.filter((p) => p.issueType === type).length;
}

function enrichRecommendationCopy(
  rec: SeoRecommendation,
  page: SeoRecommendationPageInput,
  input: GenerateAiSeoRecommendationsInput,
): SeoRecommendation {
  const count = Math.max(1, issueCount(input, rec.type));
  const keywordContext = normalizeKeywordContext(input.keywordContext);
  const wording = buildSuggestedWording(page, keywordContext);
  const wordingText = formatSuggestedWording(wording);
  const cadence = input.crawlCadenceNote ? ` ${input.crawlCadenceNote}` : "";

  if (rec.type === "missing_meta_description") {
    return {
      ...rec,
      title: `Priority ${rec.priority}: add meta descriptions where search previews are blank`,
      problem: `You have ${count} page${count === 1 ? "" : "s"} missing meta descriptions. That is ${count} missed chance${count === 1 ? "" : "s"} to control what people see before they click.`,
      suggestedFix: `Start with ${rec.pageUrl}. Open the page metadata, add a clear 140-ish character description, publish it, then save the next crawl for checking the highest-value pages first.${cadence}`,
      suggestedText: wording?.metaDescription ?? rec.suggestedText,
      placement: "Set this in the page metadata description field. Homepage and top traffic pages go first.",
      whyItMatters: "Google may write its own snippet if you leave this blank. That can make your search result sound like it was assembled by a raccoon with a deadline.",
      estimatedImpact: "Better search previews can improve click clarity, especially on homepage, service, about, and contact pages.",
    };
  }
  if (rec.type === "missing_title") {
    return {
      ...rec,
      title: `Priority ${rec.priority}: give this page a search result title`,
      problem: `This page is missing a title. Titles are the little billboard people see in search and browser tabs.`,
      suggestedFix: `Use a simple formula: main service or page topic + business name. Keep it readable first; the rough sweet spot is short enough not to ramble.${cadence}${wordingText ? `\n\n${wordingText}` : ""}`,
      suggestedText: wording?.title ?? rec.suggestedText,
      placement: "Set this in the page metadata title field.",
      whyItMatters: "A clear title helps search engines understand the page and helps humans decide whether to click.",
      estimatedImpact: "Improves search result clarity and can lift clicks on important pages.",
    };
  }
  if (rec.type === "missing_h1") {
    return {
      ...rec,
      title: `Priority ${rec.priority}: add one clear H1 headline`,
      problem: `This page is missing a clear H1. The H1 tells visitors, 'yes, you landed in the right place.' Tiny but mighty.`,
      suggestedFix: `Add one visible headline near the top of the page. Make it match the page’s purpose, not a clever inside joke.${wordingText ? `\n\n${wordingText}` : ""}`,
      suggestedText: wording?.h1 ?? rec.suggestedText,
      placement: "Place it near the top of the page as the main visible heading.",
      whyItMatters: "Visitors scan before reading, and search engines use the H1 as a strong topic clue.",
      estimatedImpact: "Improves page clarity and makes the fix easy to verify on the next crawl.",
    };
  }
  if (rec.type === "broken_page") {
    return {
      ...rec,
      problem: `This URL returned HTTP ${page.status}. That usually means the page is unavailable, moved, or blocked.`,
      suggestedFix: "If the page should exist, restore it. If it moved, redirect it to the closest relevant live page. If it is gone on purpose, remove internal links pointing to it.",
      whyItMatters: "Broken pages frustrate customers and tell crawlers they found a locked door.",
      estimatedImpact: "Fixing this protects visitor trust and keeps crawlers from wasting time on dead ends.",
    };
  }
  return rec;
}

function fallbackForPage(page: SeoRecommendationPageInput, priority: number): SeoRecommendation | null {
  const path = page.path || normalizePath(page.url);
  const topic = pageTopic(page);
  const severity = severityFromPage(page);
  const missingH1 = !page.h1?.trim() || page.issueType === "missing_h1";
  const missingTitle = !page.title?.trim() || page.issueType === "missing_title";
  const missingMeta = !page.metaDescription?.trim() || page.issueType === "missing_meta_description";

  if (page.status != null && page.status >= 400) {
    return {
      id: stableId("broken_page", path, priority),
      type: "broken_page",
      pageUrl: path,
      severity,
      priority,
      title: `Fix the broken page at ${path}`,
      problem: `This page returned HTTP ${page.status}, so visitors and crawlers may not be able to use it.`,
      currentValue: String(page.status),
      suggestedFix: "Restore the page, redirect it to the closest relevant live page, or remove internal links pointing to it.",
      suggestedText: null,
      placement: "Update the route, CMS entry, redirect rule, or navigation link that leads to this URL.",
      whyItMatters: "Broken URLs waste crawl budget and create a poor visitor experience.",
      estimatedImpact: "Improves crawl reliability and prevents users from landing on dead pages.",
      effort: "medium",
      copyable: false,
    };
  }

  if (missingH1) {
    const suggested = `${topic} for Small Businesses`;
    return {
      id: stableId("missing_h1", path, priority),
      type: "missing_h1",
      pageUrl: path,
      severity: severity === "low" ? "high" : severity,
      priority,
      title: `Add a clear H1 to ${path}`,
      problem: "This page does not appear to have an H1 tag.",
      currentValue: page.h1,
      suggestedFix: `Add this as the main page headline: ${suggested}`,
      suggestedText: suggested,
      placement: "Place this near the top of the page as the main visible headline, wrapped in an <h1> tag.",
      whyItMatters: "The H1 helps search engines and visitors understand the main topic of the page.",
      estimatedImpact: "Improves topical clarity and may help the page rank for relevant searches.",
      effort: "quick",
      copyable: true,
    };
  }

  if (missingTitle) {
    const suggested = `${topic} | Commit Happens`;
    return {
      id: stableId("missing_title", path, priority),
      type: "missing_title",
      pageUrl: path,
      severity: "high",
      priority,
      title: `Write a search result title for ${path}`,
      problem: "This page is missing a page title or the crawler could not read one.",
      currentValue: page.title,
      suggestedFix: `Use this title tag: ${suggested}`,
      suggestedText: suggested,
      placement: "Set this in the page metadata <title> field.",
      whyItMatters: "The title is often the first text users see in search results and browser tabs.",
      estimatedImpact: "Can improve click clarity and help Google understand the page topic.",
      effort: "quick",
      copyable: true,
    };
  }

  if (missingMeta) {
    const suggested = `Learn how ${topic.toLowerCase()} can help visitors understand what to do next, with clear details and practical next steps.`;
    return {
      id: stableId("missing_meta_description", path, priority),
      type: "missing_meta_description",
      pageUrl: path,
      severity: "medium",
      priority,
      title: `Add a meta description to ${path}`,
      problem: "This page is missing a meta description or the crawler could not read one.",
      currentValue: page.metaDescription,
      suggestedFix: `Add this meta description: ${suggested}`,
      suggestedText: suggested,
      placement: "Set this in the page metadata description field.",
      whyItMatters: "A clear meta description can make the search result more useful and more clickable.",
      estimatedImpact: "May improve search result clarity and click-through rate.",
      effort: "quick",
      copyable: true,
    };
  }

  if (page.internalLinksCount != null && page.internalLinksCount < 2) {
    return {
      id: stableId("internal_links", path, priority),
      type: "internal_links",
      pageUrl: path,
      severity: "medium",
      priority,
      title: `Add internal links from ${path}`,
      problem: `The crawl only found ${page.internalLinksCount} internal link${page.internalLinksCount === 1 ? "" : "s"} on this page.`,
      currentValue: String(page.internalLinksCount),
      suggestedFix: "Add links from this page to the most relevant service, pricing, contact, or supporting content pages.",
      suggestedText: null,
      placement: "Place links in the body copy where they naturally help visitors choose the next step.",
      whyItMatters: "Internal links help visitors keep moving and help search engines understand which pages are important.",
      estimatedImpact: "Improves discovery of important pages and strengthens site structure.",
      effort: "medium",
      copyable: false,
    };
  }

  return null;
}

function buildFallbackRecommendations(
  input: GenerateAiSeoRecommendationsInput,
  error?: string,
): AiSeoRecommendationsResult {
  const recommendations = input.pages
    .map((page, index) => {
      const rec = fallbackForPage(page, index + 1);
      return rec ? enrichRecommendationCopy(rec, page, input) : null;
    })
    .filter((rec): rec is SeoRecommendation => rec != null)
    .slice(0, MAX_RECOMMENDATIONS)
    .map((rec, index) => ({ ...rec, priority: index + 1, id: stableId(rec.type, rec.pageUrl, index + 1) }));
  const top = recommendations[0] ?? null;
  const missingMeta = issueCount(input, "missing_meta_description");
  const brokenPages = issueCount(input, "broken_page");
  const pattern = buildPatternResponse({
    pattern:
      brokenPages > 0
        ? "critical_issue"
        : recommendations.length > 1
          ? "multiple_issues"
          : recommendations.length === 1
            ? "issue_detected"
            : "all_clear",
    seed: `${input.siteUrl}:${top?.type ?? "clear"}:${recommendations.length}`,
    what:
      recommendations.length > 0
        ? `Saved crawl data found ${recommendations.length} prioritized SEO fix${recommendations.length === 1 ? "" : "es"}. ${missingMeta > 0 ? `${missingMeta} page${missingMeta === 1 ? "" : "s"} need meta descriptions.` : ""}`
        : "The saved crawl data does not show a page-level issue I can responsibly nag you about right now.",
    why:
      top?.whyItMatters ??
      "Clean crawl signals help search engines and visitors understand the site without making them solve a tiny mystery.",
    next:
      top != null
        ? `Start here: ${top.suggestedFix}`
        : "Next step: keep the crawl clean and focus on improving the pages that already get attention.",
    checklist:
      recommendations.length > 0
        ? recommendations.slice(0, 5).map((rec) => rec.suggestedFix)
        : ["Review homepage title and meta description.", "Confirm top pages have clear H1s.", "Run SEO Crawl after meaningful edits."],
    priority: top?.severity ?? "none",
    confidence: "stored data",
    basedOn: [
      `Latest saved crawl for ${input.siteUrl}.`,
      `${input.pages.length} crawled page${input.pages.length === 1 ? "" : "s"} included in recommendation input.`,
      `${brokenPages} broken page${brokenPages === 1 ? "" : "s"}, ${missingMeta} missing meta description${missingMeta === 1 ? "" : "s"}.`,
      input.crawlCadenceNote ?? "Recommendation cadence depends on the current plan.",
    ],
  });

  return {
    source: "fallback",
    model: null,
    generatedAt: new Date().toISOString(),
    recommendations,
    summary:
      recommendations.length > 0
        ? `You’re not in trouble, but you’re leaving easy wins on the table. Based on saved crawl data, not live re-analysis. ${input.crawlCadenceNote ?? ""}`.trim()
        : "No crawl-backed recommendations are available yet. Run SEO Crawl and I’ll have actual page-level advice instead of throwing glitter at guesses.",
    sections: pattern.sections,
    checklist: pattern.checklist,
    priority: pattern.priority,
    confidence: pattern.confidence,
    basedOn: pattern.basedOn,
    error,
  };
}

function validateRecommendation(value: unknown, index: number): SeoRecommendation | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const severity = v.severity;
  const effort = v.effort;
  if (severity !== "critical" && severity !== "high" && severity !== "medium" && severity !== "low") return null;
  if (effort !== "quick" && effort !== "medium" && effort !== "larger") return null;
  const type = typeof v.type === "string" ? v.type.trim() : "";
  const pageUrl = typeof v.pageUrl === "string" ? v.pageUrl.trim() : "";
  const title = typeof v.title === "string" ? v.title.trim() : "";
  const problem = typeof v.problem === "string" ? v.problem.trim() : "";
  const suggestedFix = typeof v.suggestedFix === "string" ? v.suggestedFix.trim() : "";
  const whyItMatters = typeof v.whyItMatters === "string" ? v.whyItMatters.trim() : "";
  if (!type || !pageUrl || !title || !problem || !suggestedFix || !whyItMatters) return null;
  return {
    id: typeof v.id === "string" && v.id.trim() ? v.id.trim() : stableId(type, pageUrl, index + 1),
    type,
    pageUrl,
    severity,
    priority: typeof v.priority === "number" && Number.isFinite(v.priority) ? v.priority : index + 1,
    title,
    problem,
    currentValue: typeof v.currentValue === "string" ? v.currentValue : null,
    suggestedFix,
    suggestedText: typeof v.suggestedText === "string" && v.suggestedText.trim() ? v.suggestedText.trim() : null,
    placement: typeof v.placement === "string" && v.placement.trim() ? v.placement.trim() : null,
    whyItMatters,
    estimatedImpact:
      typeof v.estimatedImpact === "string" && v.estimatedImpact.trim() ? v.estimatedImpact.trim() : null,
    effort,
    copyable: Boolean(v.copyable),
  };
}

function normalizeAiOutput(value: unknown): { recommendations: SeoRecommendation[]; summary: string } {
  if (!value || typeof value !== "object") {
    throw new Error("output_not_object");
  }
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.recommendations)) {
    throw new Error("missing_recommendations");
  }
  const recommendations = v.recommendations
    .map((rec, index) => validateRecommendation(rec, index))
    .filter((rec): rec is SeoRecommendation => rec != null)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_RECOMMENDATIONS)
    .map((rec, index) => ({
      ...rec,
      priority: index + 1,
      id: rec.id || stableId(rec.type, rec.pageUrl, index + 1),
    }));
  return {
    recommendations,
    summary:
      typeof v.summary === "string" && v.summary.trim()
        ? v.summary.trim()
        : "Page-specific SEO recommendations generated from the latest crawl.",
  };
}

async function callRecommendationModel(
  model: string,
  input: GenerateAiSeoRecommendationsInput,
  signal?: AbortSignal,
): Promise<{ recommendations: SeoRecommendation[]; summary: string }> {
  const client = getOpenAiClient();
  const keywordContext = normalizeKeywordContext(input.keywordContext);
  const keywordInstruction = keywordContext
    ? `Use the provided keyword context as strategic guidance, not as stuffing instructions. Prefer recommendations that improve relevance for primary keywords (${keywordContext.primaryKeywords.join(", ")}) and supporting topics (${keywordContext.supportingKeywords.join(", ")}). Avoid forcing keywords where they do not match page intent.${
        keywordContext.avoidKeywords?.length
          ? ` Avoid these terms unless already present and necessary: ${keywordContext.avoidKeywords.join(", ")}.`
          : ""
      }`
    : "No keyword context was provided, so infer page intent only from the crawl data.";
  const response = await client.responses.create(
    {
      model,
      instructions:
        `You are the Commit Happens SEO co-pilot for small business owners. Generate specific, page-level SEO fix recommendations from only the provided saved crawl data. Be plain-English, practical, lightly playful, and never robotic. Explain fixes so a non-technical person knows exactly where to click, what field to edit, what text to paste, and how to confirm it worked. Include business impact and exact next steps. For missing metadata, titles, or H1s, give suggested wording only when page URL/title/context supports it; otherwise say what context is missing. For broken pages/status codes, explain the status and whether to restore, redirect, remove, or fix links. Do not invent facts, products, locations, live checks, planned integrations, secrets, or broken links that are not supported by the input. Mention plan crawl cadence when included so users batch fixes before spending the next crawl. ${keywordInstruction} If data is thin, say so through conservative recommendations. Prioritize by impact and ease. Return valid JSON only.`,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Generate page-specific SEO recommendations from this compact crawl payload:\n${JSON.stringify(input)}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "seo_recommendations",
          schema: SEO_RECOMMENDATIONS_JSON_SCHEMA,
          strict: true,
        },
      },
    },
    { signal },
  );

  const raw = response.output_text;
  if (!raw?.trim()) {
    throw new Error("empty_ai_output");
  }
  return normalizeAiOutput(JSON.parse(raw));
}

async function callRecommendationModelWithTimeout(
  model: string,
  input: GenerateAiSeoRecommendationsInput,
): Promise<{ recommendations: SeoRecommendation[]; summary: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("ai_generation_timeout"), MODEL_TIMEOUT_MS);
  try {
    return await callRecommendationModel(model, input, controller.signal);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error("ai_generation_timeout");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function cacheKey(input: GenerateAiSeoRecommendationsInput): string {
  const keywordContext = normalizeKeywordContext(input.keywordContext);
  return JSON.stringify({
    siteUrl: input.siteUrl,
    keywordContext,
    pages: input.pages.map((p) => ({
      url: p.url,
      status: p.status,
      title: p.title,
      meta: p.metaDescription,
      h1: p.h1,
      issue: p.issueType,
      severity: p.issueSeverity,
      links: p.internalLinksCount,
    })),
  });
}

function pageForRecommendation(
  rec: SeoRecommendation,
  input: GenerateAiSeoRecommendationsInput,
): SeoRecommendationPageInput | null {
  return (
    input.pages.find((page) => page.path === rec.pageUrl || normalizePath(page.url) === rec.pageUrl || page.url === rec.pageUrl) ??
    input.pages.find((page) => page.issueType === rec.type) ??
    null
  );
}

export async function generateAiSeoRecommendations(
  input: GenerateAiSeoRecommendationsInput,
): Promise<AiSeoRecommendationsResult> {
  const key = cacheKey(input);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (!isOpenAiConfigured()) {
    return buildFallbackRecommendations(input, "openai_not_configured");
  }

  const models = [getFastAiModel()];
  let lastError = "ai_generation_failed";
  for (const model of models) {
    try {
      const output = await callRecommendationModelWithTimeout(model, input);
      const recommendations = output.recommendations.map((rec) => {
        const page = pageForRecommendation(rec, input);
        return page ? enrichRecommendationCopy(rec, page, input) : rec;
      });
      const top = recommendations[0] ?? null;
      const pattern = buildPatternResponse({
        pattern:
          recommendations.some((rec) => rec.severity === "critical")
            ? "critical_issue"
            : recommendations.length > 1
              ? "multiple_issues"
              : recommendations.length === 1
                ? "issue_detected"
                : "all_clear",
        seed: `${input.siteUrl}:ai:${top?.id ?? "clear"}`,
        what: output.summary,
        why: top?.whyItMatters ?? "This is grounded in the latest saved crawl data and avoids guessing beyond the pages provided.",
        next: top ? `Start here: ${top.suggestedFix}` : "Keep the crawl clean and improve the pages that already attract visitors.",
        checklist:
          recommendations.length > 0
            ? recommendations.slice(0, 5).map((rec) => rec.suggestedFix)
            : ["Review homepage metadata.", "Confirm top pages have clear titles and H1s.", "Run SEO Crawl after meaningful edits."],
        priority: top?.severity ?? "none",
        confidence: "stored data",
        basedOn: [
          `Latest saved crawl for ${input.siteUrl}.`,
          `${input.pages.length} page${input.pages.length === 1 ? "" : "s"} passed to the recommendation engine.`,
          input.crawlCadenceNote ?? "Recommendation cadence depends on the current plan.",
        ],
      });
      const result: AiSeoRecommendationsResult = {
        source: "ai",
        model,
        generatedAt: new Date().toISOString(),
        recommendations,
        summary: output.summary,
        sections: pattern.sections,
        checklist: pattern.checklist,
        priority: pattern.priority,
        confidence: pattern.confidence,
        basedOn: pattern.basedOn,
      };
      cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: result });
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return buildFallbackRecommendations(input, lastError);
}
