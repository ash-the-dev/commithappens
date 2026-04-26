import type { Mention, SocialProvider } from './types'

type BraveSearchResult = {
  title?: string
  description?: string
  url?: string
  profile?: {
    name?: string
  }
  meta_url?: {
    hostname?: string
  }
}

type BraveSearchResponse = {
  web?: {
    results?: BraveSearchResult[]
  }
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function isDomainTerm(term: string): boolean {
  const normalized = normalize(term)
  return !normalized.includes(' ') && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)
}

function searchQueryForTerm(term: string): string {
  const normalized = term.trim()
  if (isDomainTerm(normalized)) {
    return `"${normalized}" OR site:${normalized}`
  }

  if (normalize(normalized).includes(' ')) {
    return `"${normalized}"`
  }

  return normalized
}

function isRelevantResult(result: BraveSearchResult, term: string): boolean {
  const normalizedTerm = normalize(term)
  const title = normalize(result.title ?? '')
  const description = normalize(result.description ?? '')
  const url = normalize(result.url ?? '')

  if (
    title.includes(normalizedTerm) ||
    description.includes(normalizedTerm) ||
    url.includes(normalizedTerm)
  ) {
    return true
  }

  if (isDomainTerm(term)) {
    const domain = normalizedTerm.replace(/^https?:\/\//, '').replace(/^www\./, '')
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').includes(domain)
  }

  return false
}

function normalizeResult(result: BraveSearchResult, term: string, now: string): Mention | null {
  const url = result.url?.trim()
  const content = (result.description || result.title)?.trim()
  if (!url || !content) return null

  return {
    id: url,
    external_id: url,
    content,
    url,
    author: result.profile?.name || result.meta_url?.hostname || 'Web',
    source: 'web',
    created_at: now,
    matched_term: term,
  }
}

async function searchTerm(term: string, apiKey: string): Promise<Mention[]> {
  const url = new URL('https://api.search.brave.com/res/v1/web/search')
  url.searchParams.set('q', searchQueryForTerm(term))
  url.searchParams.set('count', '10')

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': apiKey,
    },
  })

  if (!res.ok) {
    throw new Error(`brave_search_failed_${res.status}`)
  }

  const payload = (await res.json()) as BraveSearchResponse
  const now = new Date().toISOString()

  return (payload.web?.results ?? []).flatMap((result): Mention[] => {
    if (!isRelevantResult(result, term)) return []
    const mention = normalizeResult(result, term, now)
    return mention ? [mention] : []
  })
}

export const webProvider: SocialProvider = {
  name: 'web',

  async searchMentions(terms: string[]): Promise<Mention[]> {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY?.trim()
    if (!apiKey) {
      console.warn('BRAVE_SEARCH_API_KEY is not set; skipping web mention search.')
      return []
    }

    const results = await Promise.allSettled(
      terms
        .map((term) => term.trim())
        .filter(Boolean)
        .map((term) => searchTerm(term, apiKey)),
    )

    return results.flatMap((result) => {
      if (result.status === 'fulfilled') return result.value
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason)
      console.error('Brave web search failed:', message)
      return []
    })
  },
}
