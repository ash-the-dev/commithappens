export type MentionSource = 'bluesky' | 'reddit' | 'web'

export type Mention = {
  id: string
  external_id?: string
  content: string
  url: string
  author?: string
  source: MentionSource
  created_at: string
  matched_term?: string
}

export interface SocialProvider {
  name: MentionSource
  searchMentions(terms: string[]): Promise<Mention[]>
}