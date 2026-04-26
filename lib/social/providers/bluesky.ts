import type { Mention, SocialProvider } from './types'

type BlueskyPost = {
  uri?: string
  indexedAt?: string
  author?: {
    handle?: string
    displayName?: string
  }
  record?: {
    text?: string
    createdAt?: string
  }
}

type BlueskySearchResponse = {
  posts?: BlueskyPost[]
}

function postUrl(uri: string, handle?: string): string {
  const postId = uri.split('/').filter(Boolean).at(-1)
  if (!postId || !handle) return uri
  return `https://bsky.app/profile/${encodeURIComponent(handle)}/post/${encodeURIComponent(postId)}`
}

async function searchTerm(term: string): Promise<Mention[]> {
  const url = new URL('https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts')
  url.searchParams.set('q', term)
  url.searchParams.set('limit', '10')
  url.searchParams.set('sort', 'latest')

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'CommitHappens-ReputationPulse/1.0',
    },
  })

  if (!res.ok) {
    throw new Error(`bluesky_search_failed_${res.status}`)
  }

  const payload = (await res.json()) as BlueskySearchResponse
  return (payload.posts ?? []).flatMap((post): Mention[] => {
    const uri = post.uri?.trim()
    const content = post.record?.text?.trim()
    if (!uri || !content) return []

    return [
      {
        id: uri,
        external_id: uri,
        content,
        url: postUrl(uri, post.author?.handle),
        author: post.author?.handle ?? post.author?.displayName,
        source: 'bluesky',
        created_at: post.record?.createdAt ?? post.indexedAt ?? new Date().toISOString(),
        matched_term: term,
      },
    ]
  })
}

export const blueskyProvider: SocialProvider = {
  name: 'bluesky',

  async searchMentions(terms: string[]): Promise<Mention[]> {
    const results = await Promise.allSettled(
      terms
        .map((term) => term.trim())
        .filter(Boolean)
        .map((term) => searchTerm(term)),
    )

    return results.flatMap((result) => {
      if (result.status === 'fulfilled') return result.value
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason)
      console.error('Bluesky search failed:', message)
      return []
    })
  },
}
