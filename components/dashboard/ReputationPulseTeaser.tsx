import Link from 'next/link'
import { DashboardSection } from '@/components/dashboard/DashboardSection'

const demoCards = [
  {
    sentiment: 'Negative sentiment',
    content: 'A public mention may create trust concerns if left unanswered.',
    response: 'Review the source and respond with a calm clarification.',
  },
  {
    sentiment: 'Positive sentiment',
    content: 'A customer praised how quickly the dashboard surfaced broken pages.',
    response: 'Ask for permission to turn this into proof for your landing page.',
  },
]

export function ReputationPulseTeaser() {
  return (
    <DashboardSection
      kicker="Locked"
      title="Reputation Pulse"
      subtitle="See where your brand is being mentioned, what it means, and what to do next."
    >
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 p-4">
        <div className="pointer-events-none absolute inset-0 z-10 bg-white/35 backdrop-blur-[2px]" />
        <div className="grid gap-3 sm:grid-cols-2">
          {demoCards.map((card) => (
            <article key={card.sentiment} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                {card.sentiment}
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-950">{card.content}</p>
              <p className="mt-2 text-sm text-slate-700">{card.response}</p>
            </article>
          ))}
        </div>
      </div>
      <Link
        href="/pricing"
        className="mt-4 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-brand-muted"
      >
        Upgrade to monitor your brand mentions
      </Link>
    </DashboardSection>
  )
}
