import type { Mention, SocialProvider } from './types'

export const mockProvider: SocialProvider = {
  name: 'web',

  async searchMentions(terms: string[]): Promise<Mention[]> {
    const now = new Date().toISOString()

    return terms.flatMap((term, index) => [
      {
        id: `mock-${term}-${index}-1`,
        content: `I tried ${term} and it’s actually pretty solid.`,
        url: `https://example.com/post/${encodeURIComponent(term)}-1`,
        author: 'Happy User',
        source: 'web',
        created_at: now,
      },
      {
        id: `mock-${term}-${index}-2`,
        content: `${term} might be a scam? Not sure yet.`,
        url: `https://example.com/post/${encodeURIComponent(term)}-2`,
        author: 'Concerned User',
        source: 'web',
        created_at: now,
      },
      {
        id: `mock-${term}-${index}-3`,
        content: `${term} is down again… anyone else seeing this?`,
        url: `https://example.com/post/${encodeURIComponent(term)}-3`,
        author: 'Frustrated Dev',
        source: 'web',
        created_at: now,
      },
    ])
  },
}