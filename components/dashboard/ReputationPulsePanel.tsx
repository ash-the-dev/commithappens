"use client"

import { useState, useTransition } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { DashboardSection } from "@/components/dashboard/DashboardSection"
import { SocialAttentionSection } from "@/components/dashboard/SocialAttentionSection"
import type { RecentSocialMention, SocialWatchTermForSite } from "@/lib/social/socialMentionService"
import type { SmartMockAttentionIssue } from "@/lib/dashboard/smart-mock"

type Props = {
  siteId: string
  watchTerms: SocialWatchTermForSite[]
  watchTermLimit: number
  mentions: RecentSocialMention[]
  latestCheckAt?: string | null
  reputationSummary?: { mentions: number; flagged_mentions: number } | null
  smartMockIssues?: SmartMockAttentionIssue[]
  isSmartMock?: boolean
}

function timeAgo(iso: string | null | undefined): string | null {
  if (!iso) return null
  const diffMs = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(diffMs)) return null
  const min = Math.max(0, Math.floor(diffMs / 60000))
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

function signalState(summary: Props["reputationSummary"]) {
  const mentions = summary?.mentions ?? 0
  const flagged = summary?.flagged_mentions ?? 0
  if (flagged > 0) {
    return { label: "Active risk", icon: "🚨", copy: "Active risk. Something deserves a human eyeball.", className: "border-rose-200 bg-rose-50 text-rose-950" }
  }
  if (mentions > 0) {
    return { label: "Low noise", icon: "📡", copy: "Low noise. We found mentions, but nothing looks spicy yet.", className: "border-blue-200 bg-blue-50 text-blue-950" }
  }
  return { label: "Quiet", icon: "🌙", copy: "Quiet. Nothing risky surfaced from your watch terms.", className: "border-slate-200 bg-slate-50 text-slate-800" }
}

function errorMessage(error: string): string {
  if (error === "watch_term_limit_reached") return "You hit this plan's watch-term limit. Fancy problem, annoying limit."
  if (error === "watch_term_exists") return "That term is already being watched."
  if (error === "reputation_pulse_locked") return "Reputation Pulse is locked on this plan."
  if (error === "invalid_term") return "Use a real brand, domain, product, or keyword. Two characters minimum."
  return "Could not save that watch term. Give it another shot."
}

export function ReputationPulsePanel({
  siteId,
  watchTerms,
  watchTermLimit,
  mentions,
  latestCheckAt = null,
  reputationSummary = null,
  smartMockIssues,
  isSmartMock = false,
}: Props) {
  const router = useRouter()
  const [term, setTerm] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const activeTermCount = watchTerms.filter((watchTerm) => watchTerm.is_active).length
  const canAddTerm = activeTermCount < watchTermLimit
  const latestCheckLabel = timeAgo(latestCheckAt)
  const state = signalState(reputationSummary)
  const statusLine = latestCheckLabel
    ? `Active • Last checked ${latestCheckLabel} • Scheduled reputation checks`
    : "Active • Watching stored terms during scheduled reputation checks"
  const mentionsByTerm = new Map<string, RecentSocialMention[]>()
  for (const mention of mentions) {
    const key = (mention.matched_term ?? "").toLowerCase()
    if (!key) continue
    mentionsByTerm.set(key, [...(mentionsByTerm.get(key) ?? []), mention])
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)

    startTransition(async () => {
      const response = await fetch("/api/social/watch-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, term }),
      })
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!response.ok || !payload?.ok) {
        setMessage(errorMessage(payload?.error ?? "unknown"))
        return
      }

      setTerm("")
      setMessage("Watch term saved. Scheduled reputation checks will pick it up; no fake instant scan theater.")
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <DashboardSection
        kicker="Reputation Pulse"
        title="Tell us what to watch"
        subtitle="Add your brand, domain, product, or handle. We’ll scan for mentions and rank what actually deserves your attention."
        meta={`${activeTermCount}/${watchTermLimit} watch terms used`}
      >
        <div className={`mb-4 rounded-2xl border p-4 ${state.className}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold"><span aria-hidden="true">{state.icon}</span> {state.label}</p>
            <p className="text-xs font-semibold">{statusLine}</p>
          </div>
          <p className="mt-2 text-sm">{state.copy}</p>
          <p className="mt-1 text-xs">
            {reputationSummary
              ? `${reputationSummary.flagged_mentions} flagged mentions • ${reputationSummary.mentions} total mentions in latest saved reputation view`
              : "No scan results yet. Add a watch term or wait for the next scheduled check."}
          </p>
        </div>
        <p className="mb-3 text-sm text-slate-700">
          We scan public web mentions based on your watch terms. Add your brand, domain, product name, or handle and
          we’ll watch for anything that deserves attention.
        </p>
        <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white/70 p-4 sm:grid-cols-[1fr_auto]">
          <label className="sr-only" htmlFor="reputation-watch-term">
            Brand, domain, product, or handle
          </label>
          <input
            id="reputation-watch-term"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            disabled={isPending || !canAddTerm}
            placeholder="Commit Happens, commithappens.com, @yourbrand..."
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          />
          <button
            type="submit"
            disabled={isPending || !canAddTerm || term.trim().length < 2}
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isPending ? "Saving..." : "Watch this"}
          </button>
        </form>

        {message ? <p className="mt-3 text-sm font-medium text-slate-700">{message}</p> : null}
        {!canAddTerm ? (
          <p className="mt-3 text-sm font-medium text-amber-800">You’re at the watch-term cap for this plan.</p>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {watchTerms.length > 0 ? (
            watchTerms.map((watchTerm) => (
              <div key={watchTerm.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 wrap-break-word text-sm font-bold text-slate-950">{watchTerm.term}</p>
                  <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                    {watchTerm.term_type}
                  </span>
                </div>
                <p className="mt-2 text-xs font-medium text-slate-500">
                  <span aria-hidden="true">📡</span> {watchTerm.is_active ? "Active" : "Paused"} • {watchTerm.term_type}
                  {latestCheckLabel ? ` • Last checked ${latestCheckLabel}` : ""}
                  {` • ${
                    mentionsByTerm
                      .get(watchTerm.term.toLowerCase())
                      ?.filter((mention) => mention.urgency === "high" || mention.impact_score >= 60).length ?? 0
                  } flagged`}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-600 sm:col-span-2">
              Nothing to watch yet. Add your brand, domain, product, or handle so Reputation Pulse has something to sniff.
            </div>
          )}
        </div>
      </DashboardSection>

      <SocialAttentionSection
        mentions={mentions}
        summary={reputationSummary}
        latestCheckAt={latestCheckAt}
        watchTermCount={activeTermCount}
        smartMockIssues={smartMockIssues}
        isSmartMock={isSmartMock}
      />
      <p className="text-xs leading-relaxed text-slate-500">
        Coverage includes public web/search-style mentions from configured providers. It does not include private DMs,
        locked social posts, or places the crawler cannot access.
      </p>
    </div>
  )
}
