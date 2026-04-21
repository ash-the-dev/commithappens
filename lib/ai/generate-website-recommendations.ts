import "server-only";
import { getFastAiModel, getPrimaryAiModel } from "@/lib/ai/models";
import { getOpenAiClient, isOpenAiConfigured } from "@/lib/ai/client";
import {
  validateWebsiteRecommendationsOutput,
  WEBSITE_RECOMMENDATIONS_JSON_SCHEMA,
} from "@/lib/ai/schemas";
import type {
  RecommendationCandidate,
  RecommendationPriority,
  WebsiteRecommendationsInput,
  WebsiteRecommendationsOutput,
  WebsiteRecommendationsResult,
} from "@/lib/ai/types";
import { buildRecommendedActionsInput } from "@/lib/ai/build-recommended-actions-input";

const RECOMMENDATIONS_CACHE_TTL_MS = 5 * 60 * 1000;
const recommendationsCache = new Map<
  string,
  { expiresAt: number; value: WebsiteRecommendationsResult }
>();

function highestPriority(candidates: RecommendationCandidate[]): RecommendationPriority {
  if (candidates.some((c) => c.priority === "critical")) return "critical";
  if (candidates.some((c) => c.priority === "high")) return "high";
  if (candidates.some((c) => c.priority === "medium")) return "medium";
  return "low";
}

export function buildFallbackWebsiteRecommendations(
  facts: WebsiteRecommendationsInput,
): WebsiteRecommendationsResult {
  const candidates = facts.recommended_priority_context.candidates;
  const urgent = candidates
    .filter((c) => c.priority === "critical" || c.priority === "high")
    .map((c) => c.suggested_action)
    .slice(0, 4);
  const next = candidates
    .filter((c) => c.priority === "medium")
    .map((c) => c.suggested_action)
    .slice(0, 5);
  const opportunities = candidates
    .filter((c) => c.kind === "opportunity")
    .map((c) => c.suggested_action)
    .slice(0, 4);

  const priority = highestPriority(candidates);
  const summary =
    urgent.length > 0
      ? "A few things need attention now before your next deploy."
      : "Nothing urgent. Focus on easy wins and cleaner tracking.";

  const data: WebsiteRecommendationsOutput = {
    headline:
      priority === "critical" || priority === "high"
        ? "Do this now"
        : "What I'd do next",
    summary,
    urgent_actions: urgent,
    next_actions: next.length > 0 ? next : ["Review what changed recently and make sure tracking still makes sense."],
    opportunities,
    priority_label: priority,
    confidence_note:
      "Auto suggestions from traffic, speed, uptime, and change-impact signals.",
  };

  return {
    source: "fallback",
    model: null,
    generated_at: new Date().toISOString(),
    data,
  };
}

async function callRecommendationsModel(
  model: string,
  input: WebsiteRecommendationsInput,
): Promise<WebsiteRecommendationsOutput> {
  const client = getOpenAiClient();
  const response = await client.responses.create({
    model,
    instructions:
      "You generate prioritized recommendations for CommitHappens users (indie developers, creators, small projects). Use plain English, avoid enterprise jargon, and keep advice concrete. Use only provided evidence. Avoid unsupported certainty. Keep actions concise and distinct. Return valid JSON only.",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Generate prioritized recommendations from this evidence:\n${JSON.stringify(input)}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "website_recommendations",
        schema: WEBSITE_RECOMMENDATIONS_JSON_SCHEMA,
        strict: true,
      },
    },
  });

  const raw = response.output_text;
  if (!raw || raw.trim().length === 0) {
    throw new Error("empty_ai_output");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("invalid_json_output");
  }
  const validated = validateWebsiteRecommendationsOutput(parsed);
  if (!validated.ok) {
    throw new Error(`invalid_schema_output:${validated.error}`);
  }
  return validated.data;
}

export async function generateWebsiteRecommendations(
  websiteId: string,
): Promise<WebsiteRecommendationsResult> {
  const facts = await buildRecommendedActionsInput(websiteId);
  const key = JSON.stringify({
    websiteId,
    summary: facts.summary_signals,
    uptime: facts.uptime_signals,
    threat: facts.threat_signals,
    change: facts.change_signals,
    priority: facts.recommended_priority_context.highest_priority,
  });
  const cached = recommendationsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (!isOpenAiConfigured()) {
    return buildFallbackWebsiteRecommendations(facts);
  }

  const models = [getPrimaryAiModel(), getFastAiModel()];
  let lastError = "ai_generation_failed";
  for (const model of models) {
    try {
      const data = await callRecommendationsModel(model, facts);
      const result: WebsiteRecommendationsResult = {
        source: "ai",
        model,
        generated_at: new Date().toISOString(),
        data,
      };
      recommendationsCache.set(key, {
        expiresAt: Date.now() + RECOMMENDATIONS_CACHE_TTL_MS,
        value: result,
      });
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  const fallback = buildFallbackWebsiteRecommendations(facts);
  return { ...fallback, error: lastError };
}
