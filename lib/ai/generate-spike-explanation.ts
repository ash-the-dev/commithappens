import "server-only";
import { getFastAiModel } from "@/lib/ai/models";
import { getOpenAiClient, isOpenAiConfigured } from "@/lib/ai/client";
import {
  SPIKE_EXPLANATION_JSON_SCHEMA,
  validateSpikeExplanationOutput,
} from "@/lib/ai/schemas";
import type {
  SpikeExplanationInput,
  SpikeExplanationOutput,
  SpikeExplanationResult,
} from "@/lib/ai/types";
import { buildSpikeExplanationInput } from "@/lib/ai/build-spike-explanation-input";
import type { WebsiteAnomaly } from "@/lib/db/insights";

const SPIKE_CACHE_TTL_MS = 5 * 60 * 1000;
const MODEL_TIMEOUT_MS = 6_000;
const spikeCache = new Map<
  string,
  { expiresAt: number; value: SpikeExplanationResult }
>();

function severityFromFacts(input: SpikeExplanationInput): "low" | "medium" | "high" {
  if (
    Math.abs(input.metric_deltas.pageviews_pct) >= 100 ||
    input.uptime_signals.length > 0 ||
    input.threat_signals.length > 0
  ) {
    return "high";
  }
  if (
    Math.abs(input.metric_deltas.sessions_pct) >= 30 ||
    Math.abs(input.metric_deltas.pageviews_pct) >= 30
  ) {
    return "medium";
  }
  return "low";
}

export function buildFallbackSpikeExplanation(
  facts: SpikeExplanationInput,
  reason?: string,
): SpikeExplanationResult {
  const severity = severityFromFacts(facts);
  const likelyFactors = facts.strongest_factors.length
    ? facts.strongest_factors
    : ["No single dominant factor was identified from available evidence."];
  const evidence = [
    `Sessions delta: ${facts.metric_deltas.sessions_pct.toFixed(1)}%.`,
    `Pageviews delta: ${facts.metric_deltas.pageviews_pct.toFixed(1)}%.`,
    `Events delta: ${facts.metric_deltas.events_pct.toFixed(1)}%.`,
    ...facts.uptime_signals.slice(0, 1),
    ...facts.threat_signals.slice(0, 1),
    ...facts.change_signals.slice(0, 1),
  ].slice(0, 6);
  const checks = [
    "Review top page and event shifts around the target window.",
    "Compare this anomaly window with recent change-log entries.",
    facts.uptime_signals.length > 0
      ? "Inspect uptime incidents that align with the anomaly period."
      : "Verify uptime remained stable through the anomaly period.",
  ];
  return {
    source: "fallback",
    model: null,
    generated_at: new Date().toISOString(),
    error: reason,
    data: {
      headline:
        facts.anomaly_type === "spike"
          ? "Recent spike aligns with measured behavior shifts"
          : "Recent drop aligns with measured behavior shifts",
      summary: `This ${facts.anomaly_type} on ${facts.target_date} aligns with measured metric and behavior changes in the compared baseline window.`,
      likely_factors: likelyFactors.slice(0, 5),
      supporting_evidence: evidence,
      recommended_checks: checks,
      confidence_note:
        "Deterministic fallback explanation derived from structured comparative evidence.",
      impact_label: facts.anomaly_type,
      severity,
    },
  };
}

async function callSpikeModel(
  model: string,
  facts: SpikeExplanationInput,
  signal?: AbortSignal,
): Promise<SpikeExplanationOutput> {
  const client = getOpenAiClient();
  const response = await client.responses.create(
    {
      model,
      instructions:
        "You explain weird dashboard shifts for CommitHappens users in plain English. Be concise, honest, and slightly playful without being flippant. Use only provided evidence. Avoid hard causation claims; describe likely contributing factors and correlations. Return only valid JSON.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Explain this anomaly evidence:\n${JSON.stringify(facts)}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "spike_explanation",
          schema: SPIKE_EXPLANATION_JSON_SCHEMA,
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
  const validated = validateSpikeExplanationOutput(parsed);
  if (!validated.ok) {
    throw new Error(`invalid_schema_output:${validated.error}`);
  }
  return validated.data;
}

async function callSpikeModelWithTimeout(
  model: string,
  facts: SpikeExplanationInput,
): Promise<SpikeExplanationOutput> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("ai_generation_timeout"), MODEL_TIMEOUT_MS);
  try {
    return await callSpikeModel(model, facts, controller.signal);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error("ai_generation_timeout");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateSpikeExplanation(
  websiteId: string,
  targetDate: string,
  anomaly?: WebsiteAnomaly,
): Promise<SpikeExplanationResult> {
  const facts = await buildSpikeExplanationInput(websiteId, targetDate, anomaly);
  const key = JSON.stringify({
    websiteId,
    targetDate,
    anomalyType: facts.anomaly_type,
    focus: facts.metric_focus,
    deltas: facts.metric_deltas,
    topPages: facts.top_page_deltas.map((p) => [p.path, p.current, p.baseline]),
    topEvents: facts.top_event_deltas.map((e) => [e.event_name, e.current, e.baseline]),
  });
  const cached = spikeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (!isOpenAiConfigured()) {
    return buildFallbackSpikeExplanation(facts, "openai_not_configured");
  }

  const models = [getFastAiModel()];
  let lastError = "ai_generation_failed";
  for (const model of models) {
    try {
      const data = await callSpikeModelWithTimeout(model, facts);
      const result: SpikeExplanationResult = {
        source: "ai",
        model,
        data,
        generated_at: new Date().toISOString(),
      };
      spikeCache.set(key, {
        expiresAt: Date.now() + SPIKE_CACHE_TTL_MS,
        value: result,
      });
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return buildFallbackSpikeExplanation(facts, lastError);
}
