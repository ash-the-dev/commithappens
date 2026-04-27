import "server-only";
import { getFastAiModel } from "@/lib/ai/models";
import { getOpenAiClient, isOpenAiConfigured } from "@/lib/ai/client";

export type AiConfidence = "early signal" | "confirmed trend" | "needs more data";

export type ReputationResponseInput = {
  mentionText: string;
  sentiment: "positive" | "neutral" | "negative";
  platform: string;
  businessName: string;
  preferredTone?: string;
};

export type ReputationResponseOutput = {
  suggestedResponse: string;
  tone: string;
  cautionNotes: string;
  confidence: AiConfidence;
};

function fallbackReputationResponse(input: ReputationResponseInput): ReputationResponseOutput {
  if (input.sentiment === "positive") {
    return {
      suggestedResponse: `Thanks for the kind words about ${input.businessName}. We appreciate you taking the time to say it publicly.`,
      tone: "warm and grateful",
      cautionNotes: "Keep it short. Do not turn a compliment into a sales brochure.",
      confidence: "early signal",
    };
  }
  if (input.sentiment === "negative") {
    return {
      suggestedResponse: `Thanks for flagging this. We’re going to take a closer look and make it right where we can.`,
      tone: "calm and accountable",
      cautionNotes: "Do not argue publicly. Acknowledge, clarify once, then move sensitive details private.",
      confidence: "early signal",
    };
  }
  return {
    suggestedResponse: `Thanks for mentioning ${input.businessName}. Happy to clarify if anything was unclear.`,
    tone: "clear and low-drama",
    cautionNotes: "Neutral mentions do not always need a reply. Do not summon drama just because the internet blinked.",
    confidence: "early signal",
  };
}

export async function generateReputationResponse(
  input: ReputationResponseInput,
): Promise<ReputationResponseOutput> {
  if (!isOpenAiConfigured()) return fallbackReputationResponse(input);

  try {
    const client = getOpenAiClient();
    const response = await client.responses.create({
      model: process.env.AI_RECOMMENDATION_MODEL?.trim() || getFastAiModel(),
      instructions:
        "Write a practical public response for a small business reputation mention. Be calm, helpful, lightly witty only when appropriate, never defensive, and never invent facts. Return strict JSON.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                mentionText: input.mentionText,
                sentiment: input.sentiment,
                platform: input.platform,
                businessName: input.businessName,
                preferredTone: input.preferredTone ?? "Commit Happens: clear, helpful, lightly snarky, never mean",
              }),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "reputation_response",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["suggestedResponse", "tone", "cautionNotes", "confidence"],
            properties: {
              suggestedResponse: { type: "string" },
              tone: { type: "string" },
              cautionNotes: { type: "string" },
              confidence: { type: "string", enum: ["early signal", "confirmed trend", "needs more data"] },
            },
          },
        },
      },
    });
    const raw = response.output_text;
    if (!raw?.trim()) return fallbackReputationResponse(input);
    const parsed = JSON.parse(raw) as Partial<ReputationResponseOutput>;
    if (!parsed.suggestedResponse || !parsed.tone || !parsed.cautionNotes) return fallbackReputationResponse(input);
    return {
      suggestedResponse: parsed.suggestedResponse,
      tone: parsed.tone,
      cautionNotes: parsed.cautionNotes,
      confidence:
        parsed.confidence === "confirmed trend" || parsed.confidence === "needs more data"
          ? parsed.confidence
          : "early signal",
    };
  } catch (error) {
    console.error("[ai-insight] reputation response fallback used", { error });
    return fallbackReputationResponse(input);
  }
}
