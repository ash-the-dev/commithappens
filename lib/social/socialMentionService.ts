import { getPool } from '@/lib/db/pool'
import { recordCompletedScan } from '@/lib/db/scans'
import { canUseFeature, getPlanLimit, getPlanEntitlements } from '@/lib/entitlements'
import { isAdminEmail } from '@/lib/admin'
import type { Mention } from './providers'
import { createMentionHash } from './hashMention'
import { enrichMentionWithAI } from './enrichMention'
import { searchMentionsAcrossProviders } from './searchMentions'

export type SocialWatchTerm = {
  id: string
  user_id: string | null
  site_id: string | null
  term: string
  term_type: string
  reputation_mentions_per_run: number
  reputation_ai_enabled: boolean
}

export type SocialMentionCheckStats = {
  ok: true
  checked_terms: number
  found: number
  inserted: number
  skipped: number
  skipped_unauthorized: number
  enriched: number
  enrichment_failed: number
}

export type RecentSocialMention = {
  id: string
  site_id: string | null
  source: string
  url: string | null
  author: string | null
  content: string
  matched_term: string | null
  sentiment: string
  urgency: string
  impact_score: number
  summary: string | null
  suggested_response: string | null
  discovered_at: string
}

export type RecentSocialMentionSummary = {
  total: number
  newLast7Days: number
  mentions: RecentSocialMention[]
}

export type SocialWatchTermForSite = {
  id: string
  term: string
  term_type: string
  is_active: boolean
  created_at: string
}

type SocialMentionInsertCandidate = Mention & {
  published_at?: string
  discovered_at?: string
  sentiment?: string
  urgency?: string
  impact_score?: number
  ai_enriched?: boolean
}

type InsertedSocialMention = {
  id: string
  source: string
  matched_term: string | null
  content: string
  url: string | null
}

type SocialWatchTermCandidate = {
  id: string
  user_id: string | null
  site_id: string | null
  owner_user_id: string | null
  owner_email: string | null
  subscription_plan_key: string | null
  subscription_status: string | null
  term: string
  term_type: string
}

let ensuredTables = false

async function ensureSocialTables() {
  if (ensuredTables) return
  const pool = getPool()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_watch_terms (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES users (id) ON DELETE SET NULL,
      site_id uuid REFERENCES websites (id) ON DELETE SET NULL,
      term text NOT NULL,
      term_type text NOT NULL DEFAULT 'brand',
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT social_watch_terms_term_nonempty_chk CHECK (trim(term) <> ''),
      CONSTRAINT social_watch_terms_term_type_chk CHECK (
        term_type IN ('brand', 'domain', 'product', 'handle', 'keyword')
      )
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_mentions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      watch_term_id uuid REFERENCES social_watch_terms (id) ON DELETE SET NULL,
      site_id uuid REFERENCES websites (id) ON DELETE SET NULL,
      source text NOT NULL,
      external_id text,
      url text,
      author text,
      content text NOT NULL,
      content_hash text NOT NULL,
      matched_term text,
      published_at timestamptz,
      discovered_at timestamptz NOT NULL DEFAULT now(),
      sentiment text NOT NULL DEFAULT 'neutral',
      urgency text NOT NULL DEFAULT 'low',
      impact_score integer NOT NULL DEFAULT 0,
      summary text,
      suggested_response text,
      ai_enriched boolean NOT NULL DEFAULT false,
      ai_enriched_at timestamptz,
      CONSTRAINT social_mentions_content_hash_uidx UNIQUE (content_hash)
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS social_watch_terms_active_idx ON social_watch_terms (is_active, term_type, created_at DESC)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS social_watch_terms_site_idx ON social_watch_terms (site_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS social_mentions_source_idx ON social_mentions (source)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS social_mentions_discovered_at_idx ON social_mentions (discovered_at DESC)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS social_mentions_watch_term_idx ON social_mentions (watch_term_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS social_mentions_urgency_idx ON social_mentions (urgency)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS social_mentions_impact_score_idx ON social_mentions (impact_score DESC)`)
  ensuredTables = true
}

function normalizeTerm(value: string): string {
  return value.trim().toLowerCase()
}

function findWatchTermForMention(mention: Mention, terms: SocialWatchTerm[]): SocialWatchTerm | null {
  const matched = normalizeTerm(mention.matched_term ?? '')
  if (matched) {
    const exact = terms.find((term) => normalizeTerm(term.term) === matched)
    if (exact) return exact
  }

  const haystack = normalizeTerm(`${mention.content} ${mention.url}`)
  return terms.find((term) => haystack.includes(normalizeTerm(term.term))) ?? null
}

function createFallbackMentions(terms: SocialWatchTerm[]): SocialMentionInsertCandidate[] {
  const now = new Date().toISOString()

  return terms.map((term) => ({
    id: `fallback-${term.term}`,
    external_id: `fallback-${term.term}`,
    source: 'web',
    url: 'internal://analysis',
    author: 'System Insight',
    content: `No external mentions found for "${term.term}". This likely indicates low brand visibility.`,
    created_at: now,
    published_at: now,
    discovered_at: now,
    matched_term: term.term,
    sentiment: 'neutral',
    urgency: 'medium',
    impact_score: 40,
    ai_enriched: false,
  }))
}

function shouldEnrichMention(mention: InsertedSocialMention): boolean {
  if (mention.url !== 'internal://analysis') return true
  return mention.content.startsWith('No external mentions found')
}

function limitMentionsByTerm(
  mentions: Mention[],
  terms: SocialWatchTerm[],
): SocialMentionInsertCandidate[] {
  const countsByTerm = new Map<string, number>()

  return mentions.filter((mention) => {
    const watchTerm = findWatchTermForMention(mention, terms)
    if (!watchTerm) return true

    const used = countsByTerm.get(watchTerm.id) ?? 0
    if (used >= watchTerm.reputation_mentions_per_run) return false

    countsByTerm.set(watchTerm.id, used + 1)
    return true
  })
}

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['trialing', 'active', 'past_due'])

function effectivePlanForWatchTerm(term: SocialWatchTermCandidate): string {
  if (isAdminEmail(term.owner_email)) return 'unlimited'
  if (
    term.subscription_plan_key &&
    term.subscription_status &&
    ACTIVE_SUBSCRIPTION_STATUSES.has(term.subscription_status)
  ) {
    return term.subscription_plan_key
  }
  return 'free'
}

export async function getActiveSocialWatchTerms(): Promise<{
  terms: SocialWatchTerm[]
  skippedUnauthorized: number
}> {
  await ensureSocialTables()
  const pool = getPool()
  const result = await pool.query<SocialWatchTermCandidate>(
    `SELECT
       swt.id::text,
       swt.user_id::text,
       swt.site_id::text,
       w.owner_user_id::text,
       u.email AS owner_email,
       us.plan_key AS subscription_plan_key,
       us.status AS subscription_status,
       swt.term,
       swt.term_type
     FROM social_watch_terms swt
     LEFT JOIN websites w
       ON w.id = swt.site_id
     LEFT JOIN users u
       ON u.id = COALESCE(swt.user_id, w.owner_user_id)
     LEFT JOIN user_subscriptions us
       ON us.user_id = COALESCE(swt.user_id, w.owner_user_id)
     WHERE swt.is_active = true
       AND trim(swt.term) <> ''
     ORDER BY swt.created_at ASC`,
  )

  const countsByOwner = new Map<string, number>()
  let skippedUnauthorized = 0
  const terms: SocialWatchTerm[] = []

  for (const row of result.rows) {
    const plan = effectivePlanForWatchTerm(row)
    const watchTermLimit = getPlanLimit(plan, 'reputationWatchTerms') ?? 0
    const ownerKey = row.site_id ?? row.user_id ?? row.owner_user_id ?? row.id

    if (!canUseFeature(plan, 'reputationPulse') || watchTermLimit <= 0) {
      skippedUnauthorized += 1
      continue
    }

    const used = countsByOwner.get(ownerKey) ?? 0
    if (used >= watchTermLimit) {
      skippedUnauthorized += 1
      continue
    }

    countsByOwner.set(ownerKey, used + 1)
    terms.push({
      id: row.id,
      user_id: row.user_id ?? row.owner_user_id,
      site_id: row.site_id,
      term: row.term,
      term_type: row.term_type,
      reputation_mentions_per_run: getPlanLimit(plan, 'reputationMentionsPerRun') ?? 0,
      reputation_ai_enabled: getPlanEntitlements(plan).reputationAiEnrichmentEnabled,
    })
  }

  return { terms, skippedUnauthorized }
}

export async function runSocialMentionCheck(): Promise<SocialMentionCheckStats> {
  const { terms: watchTerms, skippedUnauthorized } = await getActiveSocialWatchTerms()
  if (watchTerms.length === 0) {
    return {
      ok: true,
      checked_terms: 0,
      found: 0,
      inserted: 0,
      skipped: 0,
      skipped_unauthorized: skippedUnauthorized,
      enriched: 0,
      enrichment_failed: 0,
    }
  }

  const providerMentions = await searchMentionsAcrossProviders(watchTerms.map((term) => term.term))
  const limitedProviderMentions = limitMentionsByTerm(providerMentions, watchTerms)
  const mentions: SocialMentionInsertCandidate[] =
    limitedProviderMentions.length === 0 ? createFallbackMentions(watchTerms) : limitedProviderMentions
  const pool = getPool()
  const insertedMentions: InsertedSocialMention[] = []
  let inserted = 0
  let skipped = 0
  let enriched = 0
  let enrichmentFailed = 0

  for (const mention of mentions) {
    const watchTerm = findWatchTermForMention(mention, watchTerms)
    if (!watchTerm) {
      skipped += 1
      continue
    }

    const contentHash = createMentionHash(mention)
    const result = await pool.query<InsertedSocialMention>(
      `INSERT INTO social_mentions (
         watch_term_id,
         site_id,
         source,
         external_id,
         url,
         author,
         content,
         content_hash,
         matched_term,
         published_at,
         discovered_at,
         sentiment,
         urgency,
         impact_score,
         ai_enriched
       ) VALUES (
         $1::uuid,
         $2::uuid,
         $3,
         $4,
         $5,
         $6,
         $7,
         $8,
         $9,
         $10::timestamptz,
         $11::timestamptz,
         $12,
         $13,
         $14,
         $15
       )
       ON CONFLICT (content_hash) DO NOTHING
       RETURNING id::text, source, matched_term, content, url`,
      [
        watchTerm.id,
        watchTerm.site_id,
        mention.source,
        mention.external_id ?? mention.id,
        mention.url,
        mention.author ?? null,
        mention.content,
        contentHash,
        mention.matched_term ?? watchTerm.term,
        mention.published_at ?? mention.created_at,
        mention.discovered_at ?? new Date().toISOString(),
        mention.sentiment ?? 'neutral',
        mention.urgency ?? 'low',
        mention.impact_score ?? 0,
        mention.ai_enriched ?? false,
      ],
    )

    if ((result.rowCount ?? 0) > 0) {
      inserted += 1
      insertedMentions.push(...result.rows)
    } else {
      skipped += 1
    }
  }

  const canEnrich = watchTerms.some((term) => term.reputation_ai_enabled)
  const enrichmentCandidates = canEnrich ? insertedMentions.filter(shouldEnrichMention).slice(0, 10) : []
  for (const mention of enrichmentCandidates) {
    try {
      const enrichment = await enrichMentionWithAI(mention)
      await pool.query(
        `UPDATE social_mentions
         SET sentiment = $2,
             urgency = $3,
             impact_score = $4,
             summary = $5,
             suggested_response = $6,
             ai_enriched = true,
             ai_enriched_at = now()
         WHERE id = $1::uuid
           AND ai_enriched = false`,
        [
          mention.id,
          enrichment.sentiment,
          enrichment.urgency,
          enrichment.impact_score,
          enrichment.summary,
          enrichment.suggested_response,
        ],
      )
      enriched += 1
    } catch (error) {
      enrichmentFailed += 1
      console.error('[social-check] mention enrichment failed', {
        mentionId: mention.id,
        error,
      })
    }
  }

  const affectedSiteIds = Array.from(new Set(watchTerms.flatMap((term) => (term.site_id ? [term.site_id] : []))))
  await Promise.all(
    affectedSiteIds.map(async (siteId) => {
      const summary = await pool.query<{ mentions: string; flagged_mentions: string }>(
        `SELECT
           count(*)::text AS mentions,
           count(*) FILTER (WHERE urgency = 'high' OR impact_score >= 60)::text AS flagged_mentions
         FROM social_mentions
         WHERE site_id = $1::uuid`,
        [siteId],
      )
      const row = summary.rows[0]
      await recordCompletedScan({
        siteId,
        scanType: 'reputation',
        resultSummary: {
          mentions: Number(row?.mentions ?? 0),
          flagged_mentions: Number(row?.flagged_mentions ?? 0),
        },
        source: 'reputation-pulse',
      })
    }),
  )

  return {
    ok: true,
    checked_terms: watchTerms.length,
    found: mentions.length,
    inserted,
    skipped,
    skipped_unauthorized: skippedUnauthorized,
    enriched,
    enrichment_failed: enrichmentFailed,
  }
}

export async function getRecentSocialMentionSummary(limit = 10): Promise<RecentSocialMentionSummary> {
  await ensureSocialTables()
  const pool = getPool()
  const safeLimit = Math.max(1, Math.min(limit, 50))
  const [counts, mentions] = await Promise.all([
    pool.query<{ total: string; new_7d: string }>(
      `SELECT
         count(*)::text AS total,
         count(*) FILTER (WHERE discovered_at >= now() - interval '7 days')::text AS new_7d
       FROM social_mentions`,
    ),
    pool.query<RecentSocialMention>(
      `SELECT
         id::text,
         site_id::text,
         source,
         url,
         author,
         content,
         matched_term,
         sentiment,
         urgency,
         impact_score,
         discovered_at::text
       FROM social_mentions
       ORDER BY impact_score DESC, discovered_at DESC
       LIMIT $1`,
      [safeLimit],
    ),
  ])

  return {
    total: Number(counts.rows[0]?.total ?? 0),
    newLast7Days: Number(counts.rows[0]?.new_7d ?? 0),
    mentions: mentions.rows,
  }
}

export async function getSocialMentionsNeedingAttention(
  siteId: string,
  limit = 5,
): Promise<RecentSocialMention[]> {
  await ensureSocialTables()
  const pool = getPool()
  const safeLimit = Math.max(1, Math.min(limit, 10))
  const result = await pool.query<RecentSocialMention>(
    `SELECT
       id::text,
       site_id::text,
       source,
       url,
       author,
       content,
       matched_term,
       sentiment,
       urgency,
       impact_score,
       summary,
       suggested_response,
       discovered_at::text
     FROM social_mentions
     WHERE site_id = $1::uuid
     ORDER BY
       impact_score DESC,
       CASE urgency
         WHEN 'high' THEN 3
         WHEN 'medium' THEN 2
         WHEN 'low' THEN 1
         ELSE 0
       END DESC,
       discovered_at DESC
     LIMIT $2`,
    [siteId, safeLimit],
  )

  return result.rows
}

export async function getSocialWatchTermsForSite(siteId: string): Promise<SocialWatchTermForSite[]> {
  await ensureSocialTables()
  const pool = getPool()
  const result = await pool.query<SocialWatchTermForSite>(
    `SELECT
       id::text,
       term,
       term_type,
       is_active,
       created_at::text
     FROM social_watch_terms
     WHERE site_id = $1::uuid
     ORDER BY created_at ASC`,
    [siteId],
  )
  return result.rows
}
