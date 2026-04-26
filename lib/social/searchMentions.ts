import type { Mention, SocialProvider } from './providers'
import { blueskyProvider, webProvider } from './providers'

const providers: SocialProvider[] = [
  webProvider,
  ...(process.env.ENABLE_BLUESKY_PROVIDER === 'true' ? [blueskyProvider] : []),
]

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function getMentionDedupeKey(m: Mention) {
  return [
    m.source,
    m.url?.trim().toLowerCase() || '',
    normalizeText(m.content),
  ].join(':')
}

function dedupeMentions(mentions: Mention[]): Mention[] {
  const seen = new Set<string>()

  return mentions.filter((mention) => {
    const key = getMentionDedupeKey(mention)

    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}

export async function searchMentionsAcrossProviders(
  terms: string[],
): Promise<Mention[]> {
  if (!terms.length) return []

  const results = await Promise.allSettled(
    providers.map((provider) => provider.searchMentions(terms)),
  )

  const allMentions = results.flatMap((result) => {
    if (result.status === 'fulfilled') {
      return result.value
    }

    const message = result.reason instanceof Error ? result.reason.message : String(result.reason)
    console.error('Social provider failed:', message)
    return []
  })

  return dedupeMentions(allMentions)
}