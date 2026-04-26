import 'server-only'
import { getOpenAiClient, isOpenAiConfigured } from '@/lib/ai/client'
import { getFastAiModel } from '@/lib/ai/models'

export type SocialMentionAiInput = {
  id: string
  source: string
  matched_term: string | null
  content: string
  url: string | null
}

export type SocialMentionAiOutput = {
  sentiment: 'positive' | 'neutral' | 'negative'
  urgency: 'low' | 'medium' | 'high'
  impact_score: number
  summary: string
  suggested_response: string
}

const SAFE_DEFAULTS: SocialMentionAiOutput = {
  sentiment: 'neutral',
  urgency: 'low',
  impact_score: 0,
  summary: 'AI enrichment unavailable.',
  suggested_response: 'Review this mention manually.',
}

const SOCIAL_MENTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['sentiment', 'urgency', 'impact_score', 'summary', 'suggested_response'],
  properties: {
    sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
    urgency: { type: 'string', enum: ['low', 'medium', 'high'] },
    impact_score: { type: 'integer', minimum: 0, maximum: 100 },
    summary: { type: 'string' },
    suggested_response: { type: 'string' },
  },
} as const

function clampImpactScore(value: unknown): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

function normalizeOutput(value: unknown): SocialMentionAiOutput {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const sentiment =
    row.sentiment === 'positive' || row.sentiment === 'negative' || row.sentiment === 'neutral'
      ? row.sentiment
      : 'neutral'
  const urgency =
    row.urgency === 'low' || row.urgency === 'medium' || row.urgency === 'high' ? row.urgency : 'low'

  return {
    sentiment,
    urgency,
    impact_score: clampImpactScore(row.impact_score),
    summary: typeof row.summary === 'string' && row.summary.trim() ? row.summary.trim() : SAFE_DEFAULTS.summary,
    suggested_response:
      typeof row.suggested_response === 'string' && row.suggested_response.trim()
        ? row.suggested_response.trim()
        : SAFE_DEFAULTS.suggested_response,
  }
}

export async function enrichMentionWithAI(mention: SocialMentionAiInput): Promise<SocialMentionAiOutput> {
  if (!isOpenAiConfigured()) {
    return SAFE_DEFAULTS
  }

  try {
    const client = getOpenAiClient()
    const response = await client.responses.create({
      model: process.env.AI_RECOMMENDATION_MODEL?.trim() || getFastAiModel(),
      instructions:
        'Analyze this brand/web mention. Decide what should be looked at first. Return JSON only.',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify({
                source: mention.source,
                matched_term: mention.matched_term,
                content: mention.content,
                url: mention.url,
                output:
                  'Return sentiment, urgency, impact_score 0-100, one short summary, and one practical suggested_response.',
              }),
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'social_mention_enrichment',
          schema: SOCIAL_MENTION_SCHEMA,
          strict: true,
        },
      },
    })

    const raw = response.output_text
    if (!raw?.trim()) return SAFE_DEFAULTS
    return normalizeOutput(JSON.parse(raw))
  } catch (error) {
    console.error('[social-ai-enrichment] generation skipped', {
      mentionId: mention.id,
      error,
    })
    return SAFE_DEFAULTS
  }
}
