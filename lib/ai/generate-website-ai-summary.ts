import "server-only";
import { getFastAiModel } from "@/lib/ai/models";
import { getOpenAiClient, isOpenAiConfigured } from "@/lib/ai/client";
import {
  validateWebsiteAiSummaryOutput,
  WEBSITE_AI_SUMMARY_JSON_SCHEMA,
} from "@/lib/ai/schemas";
import type {
  WebsiteAiSummaryInput,
  WebsiteAiSummaryOutput,
  WebsiteAiSummaryResult,
} from "@/lib/ai/types";

const CACHE_TTL_MS = 5 * 60 * 1000;
const MODEL_TIMEOUT_MS = 6_000;
const summaryCache = new Map<
  string,
  { expiresAt: number; value: WebsiteAiSummaryResult }
>();

function cacheKey(input: WebsiteAiSummaryInput): string {
  return JSON.stringify({
    website: input.website_name,
    summary_24h: input.summary_24h,
    threats: input.threats,
    anomalies: input.anomalies.slice(0, 3),
    changes: input.recent_changes.map((c) => ({
      title: c.title,
      created_at: c.created_at,
      flags: c.flags,
    })),
  });
}

function severityFromInput(input: WebsiteAiSummaryInput): "low" | "medium" | "high" {
  if (input.threats.high_risk_sessions > 0 || input.uptime.uptime_pct_24h < 99) {
    return "high";
  }
  if (input.threats.total_flagged_sessions > 0 || input.anomalies.length > 0) {
    return "medium";
  }
  return "low";
}

export function buildFallbackWebsiteSummary(
  input: WebsiteAiSummaryInput,
  reason?: string,
): WebsiteAiSummaryResult {
  const severity = severityFromInput(input);
  const bullets = [
    `24h: ${input.summary_24h.sessions} sessions, ${input.summary_24h.pageviews} pageviews, ${input.summary_24h.events} events.`,
    input.anomalies[0]
      ? `Top anomaly: ${input.anomalies[0].metric} ${input.anomalies[0].type} (${input.anomalies[0].percent_change.toFixed(1)}%).`
      : "Nothing looks broken right now.",
    input.threats.total_flagged_sessions > 0
      ? `Threat signals: ${input.threats.total_flagged_sessions} flagged session(s), ${input.threats.high_risk_sessions} high-risk.`
      : "Everything looks pretty calm right now.",
  ];
  const actions = [
    input.uptime.has_checks
      ? "Check failed uptime pings first so outages don't sneak past you."
      : "Set up alerts so you're not the last to know your site died.",
    input.threats.total_flagged_sessions > 0
      ? "Review flagged sessions and repeated risk patterns before they waste your time."
      : "Keep an eye on weird traffic swings after each deploy.",
    "Track what you changed, or this data won't mean much.",
  ];

  const headline =
    severity === "high"
      ? "Something needs attention"
      : severity === "medium"
        ? "Stuff moved more than usual"
        : "Nothing weird going on. For once.";

  return {
    source: "fallback",
    model: null,
    generated_at: new Date().toISOString(),
    error: reason,
    data: {
      headline,
      summary: input.deterministic_signals.insight_summary,
      bullets: bullets.slice(0, 5),
      recommended_actions: actions.slice(0, 4),
      severity,
      confidence_note:
        "Auto summary from measured traffic, speed, uptime, and change signals.",
    },
  };
}

async function callSummaryModel(
  model: string,
  input: WebsiteAiSummaryInput,
  signal?: AbortSignal,
): Promise<WebsiteAiSummaryOutput> {
  const client = getOpenAiClient();
  const response = await client.responses.create(
    {
      model,
      instructions:
        "You summarize CommitHappens dashboard data for indie builders in plain English. Be direct, smart, slightly playful, and useful. Avoid enterprise jargon. Use only provided facts. Do not invent causes. Keep it concise and return only valid JSON matching the schema.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Summarize this dashboard payload:\n${JSON.stringify(input)}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "website_ai_summary",
          schema: WEBSITE_AI_SUMMARY_JSON_SCHEMA,
          strict: true,
        },
      },
    },
    { signal },
  );

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
  const validated = validateWebsiteAiSummaryOutput(parsed);
  if (!validated.ok) {
    throw new Error(`invalid_schema_output:${validated.error}`);
  }
  return validated.data;
}

async function callSummaryModelWithTimeout(
  model: string,
  input: WebsiteAiSummaryInput,
): Promise<WebsiteAiSummaryOutput> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("ai_generation_timeout"), MODEL_TIMEOUT_MS);
  try {
    return await callSummaryModel(model, input, controller.signal);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error("ai_generation_timeout");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateWebsiteAiSummary(
  input: WebsiteAiSummaryInput,
): Promise<WebsiteAiSummaryResult> {
  const key = cacheKey(input);
  const cached = summaryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (!isOpenAiConfigured()) {
    return buildFallbackWebsiteSummary(input, "openai_not_configured");
  }

  const models = [getFastAiModel()];
  let lastError = "ai_generation_failed";
  for (const model of models) {
    try {
      const data = await callSummaryModelWithTimeout(model, input);
      const result: WebsiteAiSummaryResult = {
        source: "ai",
        model,
        data,
        generated_at: new Date().toISOString(),
      };
      summaryCache.set(key, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        value: result,
      });
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return buildFallbackWebsiteSummary(input, lastError);
}
