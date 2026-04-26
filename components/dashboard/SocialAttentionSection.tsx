import { DashboardSection } from '@/components/dashboard/DashboardSection'
import type { SmartMockAttentionIssue } from '@/lib/dashboard/smart-mock'
import type { RecentSocialMention } from '@/lib/social/socialMentionService'

type Props = {
  mentions: RecentSocialMention[]
  smartMockIssues?: SmartMockAttentionIssue[]
  isSmartMock?: boolean
}

function preview(value: string, max = 180): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max).trim()}...` : clean
}

function badgeClass(kind: 'sentiment' | 'urgency', value: string): string {
  if (kind === 'urgency') {
    if (value === 'high') return 'border-red-200 bg-red-50 text-red-700'
    if (value === 'medium') return 'border-amber-200 bg-amber-50 text-amber-800'
    return 'border-slate-200 bg-slate-50 text-slate-700'
  }

  if (value === 'positive') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (value === 'negative') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

export function SocialAttentionSection({ mentions, smartMockIssues = [], isSmartMock = false }: Props) {
  return (
    <DashboardSection
      kicker="Reputation Pulse"
      title="What Needs Attention"
      subtitle={
        isSmartMock
          ? 'Sample priorities showing how uptime, SEO, and reputation roll up into one action list.'
          : 'Highest-priority brand and web mentions from the reputation crawler.'
      }
    >
      {smartMockIssues.length > 0 ? (
        <div className="space-y-3">
          {smartMockIssues.slice(0, 3).map((issue, index) => (
            <article
              key={issue.id}
              className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 shadow-[0_18px_45px_-36px_rgba(217,119,6,0.65)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-xs font-black text-white">
                  {index + 1}
                </span>
                <span className="rounded-full border border-amber-200 bg-white/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-800">
                  {issue.category}
                </span>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${badgeClass('urgency', issue.urgency)}`}>
                  {issue.urgency} urgency
                </span>
                <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  Impact {issue.impact_score}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-950">{issue.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">{issue.detail}</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{issue.suggested_response}</p>
            </article>
          ))}
        </div>
      ) : mentions.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 text-sm font-medium text-slate-700">
          No critical mentions found
        </div>
      ) : (
        <div className="space-y-3">
          {mentions.map((mention) => (
            <article key={mention.id} className="rounded-2xl border border-slate-200/80 bg-white/75 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
                  {mention.source}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${badgeClass(
                    'sentiment',
                    mention.sentiment,
                  )}`}
                >
                  {mention.sentiment}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${badgeClass(
                    'urgency',
                    mention.urgency,
                  )}`}
                >
                  {mention.urgency} urgency
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-950">{preview(mention.content)}</p>
              <p className="mt-3 text-sm text-slate-700">
                {mention.summary || 'No summary yet.'}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {mention.suggested_response || 'Review this mention manually.'}
              </p>
            </article>
          ))}
        </div>
      )}
    </DashboardSection>
  )
}
