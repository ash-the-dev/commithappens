import type { RecentSocialMention } from '@/lib/social/socialMentionService'

export type SmartMockAttentionIssue = {
  id: string
  category: 'Uptime' | 'SEO' | 'Reputation'
  title: string
  detail: string
  urgency: 'low' | 'medium' | 'high'
  impact_score: number
  suggested_response: string
}

const NOW = '2026-04-25T18:00:00.000Z'

export const SMART_MOCK_ATTENTION_ISSUES: SmartMockAttentionIssue[] = [
  {
    id: 'mock-uptime-checkout-timeouts',
    category: 'Uptime',
    title: 'Checkout is intermittently timing out',
    detail: 'Synthetic probe saw two slow responses over 3s on the checkout path in the last hour.',
    urgency: 'high',
    impact_score: 92,
    suggested_response: 'Check recent deploys and payment-provider latency before sending more traffic to checkout.',
  },
  {
    id: 'mock-seo-missing-homepage-title',
    category: 'SEO',
    title: 'Homepage title is too vague',
    detail: 'The latest crawl found a weak title and missing meta description on the page most likely to rank.',
    urgency: 'medium',
    impact_score: 74,
    suggested_response: 'Rewrite the homepage title and meta description around the core product promise.',
  },
  {
    id: 'mock-reputation-negative-review',
    category: 'Reputation',
    title: 'Negative mention needs a calm response',
    detail: 'A user says onboarding felt confusing and they almost abandoned setup.',
    urgency: 'medium',
    impact_score: 68,
    suggested_response: 'Reply with a short acknowledgment, link the setup guide, and ask what step blocked them.',
  },
]

export const SMART_MOCK_SOCIAL_MENTIONS: RecentSocialMention[] = [
  {
    id: 'mock-social-negative-onboarding',
    site_id: null,
    source: 'web',
    url: 'internal://smart-mock/reputation-negative',
    author: 'System Insight',
    content: 'A customer says onboarding felt confusing and they almost abandoned setup before seeing value.',
    matched_term: 'Commit Happens',
    sentiment: 'negative',
    urgency: 'medium',
    impact_score: 68,
    summary: 'Onboarding friction could hurt first-run activation.',
    suggested_response: 'Reply with empathy, point to the setup guide, and ask which step caused confusion.',
    discovered_at: NOW,
  },
  {
    id: 'mock-social-positive-founder',
    site_id: null,
    source: 'web',
    url: 'internal://smart-mock/reputation-positive',
    author: 'System Insight',
    content: 'A founder says Commit Happens finally made uptime, SEO, and reputation feel like one workflow.',
    matched_term: 'Commit Happens',
    sentiment: 'positive',
    urgency: 'low',
    impact_score: 42,
    summary: 'Positive positioning signal worth reusing in launch copy.',
    suggested_response: 'Capture the language and consider asking for a testimonial.',
    discovered_at: NOW,
  },
]

export function shouldUseSmartMock(source: 'live' | 'partial' | 'demo'): boolean {
  return source === 'demo'
}
