import "server-only";
import { getFastAiModel } from "@/lib/ai/models";
import { getOpenAiClient, isOpenAiConfigured } from "@/lib/ai/client";
import {
  CHANGE_IMPACT_NARRATIVE_JSON_SCHEMA,
  validateChangeImpactNarrativeOutput,
} from "@/lib/ai/schemas";
import type {
  ChangeImpactNarrativeInput,
  ChangeImpactNarrativeResult,
  ChangeImpactNarrativeOutput,
} from "@/lib/ai/types";
import { buildChangeImpactNarrativeInput } from "@/lib/ai/build-change-impact-narrative-input";

const CHANGE_CACHE_TTL_MS = 5 * 60 * 1000;
const MODEL_TIMEOUT_MS = 6_000;
const changeNarrativeCache = new Map<
  string,
  { expiresAt: number; value: ChangeImpactNarrativeResult }
>();

function directionFromInput(
  input: ChangeImpactNarrativeInput,
): "positive" | "negative" | "mixed" | "neutral" {
  const marker = input.impact_flags.find((f) =>
    f === "positive" || f === "negative" || f === "mixed" || f === "neutral",
  );
  return (marker as "positive" | "negative" | "mixed" | "neutral") ?? "neutral";
}

function severityFromInput(input: ChangeImpactNarrativeInput): "low" | "medium" | "high" {
  if (
    input.impact_flags.includes("uptime_impact") ||
    input.impact_flags.includes("risk_change")
  ) {
    return "high";
  }
  if (
    Math.abs(input.metric_deltas.pageviews_percent_change) >= 30 ||
    Math.abs(input.metric_deltas.sessions_percent_change) >= 30
  ) {
    return "medium";
  }
  return "low";
}

export function buildFallbackChangeImpactNarrative(
  input: ChangeImpactNarrativeInput,
  reason?: string,
): ChangeImpactNarrativeResult {
  const direction = directionFromInput(input);
  const severity = severityFromInput(input);
  const notable = [
    `Sessions ${input.metric_deltas.sessions_before} -> ${input.metric_deltas.sessions_after} (${input.metric_deltas.sessions_percent_change.toFixed(
      1,
    )}%).`,
    `Pageviews ${input.metric_deltas.pageviews_before} -> ${input.metric_deltas.pageviews_after} (${input.metric_deltas.pageviews_percent_change.toFixed(
      1,
    )}%).`,
    `Events ${input.metric_deltas.events_before} -> ${input.metric_deltas.events_after} (${input.metric_deltas.events_percent_change.toFixed(
      1,
    )}%).`,
  ];
  const evidence = [
    ...input.top_page_deltas.slice(0, 2),
    ...input.top_event_deltas.slice(0, 2),
    ...input.uptime_signals.slice(0, 1),
    ...input.threat_signals.slice(0, 1),
    ...input.anomaly_signals.slice(0, 1),
  ].slice(0, 6);
  const checks = [
    "Check top page and event shifts right after this deploy.",
    input.uptime_signals.length > 0
      ? "Look at uptime incidents around this change."
      : "Confirm uptime stayed steady during this window.",
    input.threat_signals.length > 0
      ? "Check for sketchy session shifts after this change."
      : "Keep an eye on risk signals after the next deploy.",
  ];
  const summary =
    direction === "positive"
      ? "This change was followed by a useful bump in key metrics."
      : direction === "negative"
        ? "This change was followed by a dip in key metrics."
        : direction === "mixed"
          ? "This change helped some things and hurt others."
          : "This change barely moved anything noticeable.";

  return {
    source: "fallback",
    model: null,
    generated_at: new Date().toISOString(),
    error: reason,
    change_log_id: input.change_log.id,
    data: {
      headline: `${input.change_log.title}: post-change impact snapshot`,
      summary,
      notable_changes: notable,
      supporting_evidence: evidence.length
        ? evidence
        : ["No strong page/event concentration shift identified in the current window."],
      recommended_checks: checks,
      severity,
      confidence_note:
        "Auto read based on before/after impact evidence.",
      direction_label: direction,
    },
  };
}

async function callChangeNarrativeModel(
  model: string,
  input: ChangeImpactNarrativeInput,
  signal?: AbortSignal,
): Promise<ChangeImpactNarrativeOutput> {
  const client = getOpenAiClient();
  const response = await client.responses.create(
    {
      model,
      instructions:
        "You explain whether a deploy/change mattered for CommitHappens users in plain English. Be concise, direct, and useful. Use only provided evidence, avoid unsupported causation claims, and use cautious wording like aligned with/followed by/coincided with. Return valid JSON only.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Generate a change impact narrative from this evidence:\n${JSON.stringify(input)}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "change_impact_narrative",
          schema: CHANGE_IMPACT_NARRATIVE_JSON_SCHEMA,
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
  const validated = validateChangeImpactNarrativeOutput(parsed);
  if (!validated.ok) {
    throw new Error(`invalid_schema_output:${validated.error}`);
  }
  return validated.data;
}

async function callChangeNarrativeModelWithTimeout(
  model: string,
  input: ChangeImpactNarrativeInput,
): Promise<ChangeImpactNarrativeOutput> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("ai_generation_timeout"), MODEL_TIMEOUT_MS);
  try {
    return await callChangeNarrativeModel(model, input, controller.signal);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error("ai_generation_timeout");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateChangeImpactNarrative(
  changeLogId: string,
): Promise<ChangeImpactNarrativeResult | null> {
  const facts = await buildChangeImpactNarrativeInput(changeLogId);
  if (!facts) return null;

  const key = JSON.stringify({
    changeLogId,
    metricDeltas: facts.metric_deltas,
    flags: facts.impact_flags,
    strongest: facts.strongest_factors,
  });
  const cached = changeNarrativeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (!isOpenAiConfigured()) {
    return buildFallbackChangeImpactNarrative(facts, "openai_not_configured");
  }

  const models = [getFastAiModel()];
  let lastError = "ai_generation_failed";
  for (const model of models) {
    try {
      const data = await callChangeNarrativeModelWithTimeout(model, facts);
      const result: ChangeImpactNarrativeResult = {
        source: "ai",
        model,
        generated_at: new Date().toISOString(),
        data,
        change_log_id: facts.change_log.id,
      };
      changeNarrativeCache.set(key, {
        expiresAt: Date.now() + CHANGE_CACHE_TTL_MS,
        value: result,
      });
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return buildFallbackChangeImpactNarrative(facts, lastError);
}
