import "server-only";
import { getOpenAiClient, isOpenAiConfigured } from "@/lib/ai/client";

const MODEL_TIMEOUT_MS = 6_000;

export type SeoRecommendationsInput = {
  pageUrl: string;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  statusCode: number | null;
  internalLinksCount: number;
  detectedIssues: string[];
};

export type SeoRecommendationsOutput = {
  summary: string;
  recommendedWords: string[];
  titleSuggestions: string[];
  metaSuggestions: string[];
  priorityFixes: string[];
};

const SEO_RECOMMENDATIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "recommendedWords", "titleSuggestions", "metaSuggestions", "priorityFixes"],
  properties: {
    summary: { type: "string" },
    recommendedWords: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    titleSuggestions: {
      type: "array",
      items: { type: "string" },
      maxItems: 4,
    },
    metaSuggestions: {
      type: "array",
      items: { type: "string" },
      maxItems: 4,
    },
    priorityFixes: {
      type: "array",
      items: { type: "string" },
      maxItems: 6,
    },
  },
} as const;

function modelName(): string | null {
  const model = process.env.AI_RECOMMENDATION_MODEL?.trim();
  return model && model.length > 0 ? model : null;
}

function stringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, maxItems);
}

function normalizeOutput(value: unknown): SeoRecommendationsOutput {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    summary:
      typeof row.summary === "string" && row.summary.trim()
        ? row.summary.trim()
        : "Practical SEO cleanup recommendations for this page.",
    recommendedWords: stringArray(row.recommendedWords, 8),
    titleSuggestions: stringArray(row.titleSuggestions, 4),
    metaSuggestions: stringArray(row.metaSuggestions, 4),
    priorityFixes: stringArray(row.priorityFixes, 6),
  };
}

export async function generateSeoRecommendations(
  input: SeoRecommendationsInput,
): Promise<SeoRecommendationsOutput | null> {
  const model = modelName();
  if (!model || !isOpenAiConfigured()) {
    return null;
  }

  try {
    const client = getOpenAiClient();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("ai_generation_timeout"), MODEL_TIMEOUT_MS);
    const response = await client.responses
      .create(
        {
          model,
          instructions:
            "You create practical page-level SEO recommendations for Commit Happens. Be helpful, slightly clever, and concrete. Do not recommend keyword stuffing. Do not promise rankings or traffic. Use only the supplied crawl facts. Return valid JSON only.",
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `Generate SEO recommendations for this crawled page:\n${JSON.stringify(input)}`,
                },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "seo_page_recommendations",
              schema: SEO_RECOMMENDATIONS_SCHEMA,
              strict: true,
            },
          },
        },
        { signal: controller.signal },
      )
      .finally(() => clearTimeout(timeout));

    const raw = response.output_text;
    if (!raw?.trim()) return null;
    return normalizeOutput(JSON.parse(raw));
  } catch (err) {
    console.error("[seo-ai-recommendations] generation skipped", {
      pageUrl: input.pageUrl,
      err,
    });
    return null;
  }
}
