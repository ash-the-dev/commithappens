import { DashboardSection } from '@/components/dashboard/DashboardSection'
import type { SmartMockAttentionIssue } from '@/lib/dashboard/smart-mock'
import type { RecentSocialMention } from '@/lib/social/socialMentionService'

type Props = {
  mentions: RecentSocialMention[]
  summary?: { mentions: number; flagged_mentions: number } | null
  latestCheckAt?: string | null
  watchTermCount?: number
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

function timeAgo(iso: string | null | undefined): string | null {
  if (!iso) return null
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.max(0, Math.floor(diffMs / 60000))
  if (!Number.isFinite(min)) return null
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export function SocialAttentionSection({
  mentions,
  summary = null,
  latestCheckAt = null,
  watchTermCount = 0,
  smartMockIssues = [],
  isSmartMock = false,
}: Props) {
  const flaggedMentions = mentions.filter((mention) => mention.urgency === "high" || mention.impact_score >= 60)
  const latestCheck = timeAgo(latestCheckAt)
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
      <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4">
        <p className="text-sm font-semibold text-slate-950">
          <span aria-hidden="true">📡</span> Current signal state
        </p>
        <p className="mt-2 text-sm text-slate-700">
          <span className="font-semibold">What happened:</span>{" "}
          {summary
            ? `${summary.flagged_mentions} flagged mentions and ${summary.mentions} total mentions in the latest saved reputation view.`
            : "No scan results yet from configured watch terms."}
        </p>
        <p className="mt-2 text-sm text-slate-700">
          <span className="font-semibold">Why it matters:</span> quiet is good here, but only for the public places your watch terms can reach.
        </p>
        <p className="mt-2 text-sm text-slate-700">
          <span className="font-semibold">Do this next:</span>{" "}
          {watchTermCount > 0
            ? "Keep watch terms sharp and review anything flagged before it grows legs."
            : "Add your brand, domain, product, or handle so Reputation Pulse has something to sniff."}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Watched terms: {watchTermCount} {latestCheck ? `• Latest check: ${latestCheck}` : "• Waiting for scheduled check"}
        </p>
      </div>

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
      ) : flaggedMentions.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 text-sm font-medium text-slate-700">
          <p className="font-semibold text-slate-950"><span aria-hidden="true">🌙</span> No risky mentions found. Quiet is good here.</p>
          <p className="mt-2 text-sm font-normal">
            We’re still watching your public web mentions based on your active watch terms.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {summary
              ? `${summary.flagged_mentions} flagged mentions • ${summary.mentions} total mentions in latest check`
              : "No scan results yet. Add a watch term or wait for the next scheduled check."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {flaggedMentions.map((mention) => (
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
                  {mention.urgency === "high" ? "🚨 " : "⚠️ "}{mention.urgency} urgency
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-950">{mention.author || mention.source}</p>
              <p className="mt-1 text-sm leading-6 text-slate-800">{preview(mention.content)}</p>
              <p className="mt-3 text-sm text-slate-700">
                <span className="font-semibold">Why it was flagged:</span> {mention.summary || `Impact score ${mention.impact_score}; urgency marked ${mention.urgency}.`}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                <span className="font-semibold">Suggested next action:</span> {mention.suggested_response || 'Review this mention manually before replying.'}
              </p>
            </article>
          ))}
        </div>
      )}
    </DashboardSection>
  )
}
