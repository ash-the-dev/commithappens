"use client";

import { useMemo, useState } from "react";
import { AnalystAnswerView } from "@/components/dashboard/AnalystAnswerView";
import type { DashboardAnswerResult } from "@/lib/ai/types";
import { DashboardSection } from "@/components/dashboard/DashboardSection";

type Props = {
  websiteId: string;
};

const SUGGESTED_PROMPTS = [
  "What's going on with this site?",
  "Why did traffic spike?",
  "What suspicious activity should I review?",
  "What happened after the latest change?",
  "What should I fix first?",
];

type ApiResponse =
  | { ok: true; answer: DashboardAnswerResult }
  | { ok: false; error: string };

export function AnalystChatCard({ websiteId }: Props) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<DashboardAnswerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAsk = useMemo(
    () => question.trim().length > 0 && question.trim().length <= 400 && !loading,
    [question, loading],
  );

  async function askDashboard(prompt?: string) {
    const nextQuestion = (prompt ?? question).trim();
    if (!nextQuestion || nextQuestion.length > 400) return;

    setLoading(true);
    setError(null);
    if (prompt) setQuestion(nextQuestion);
    try {
      const res = await fetch("/api/internal/ai/ask-dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: websiteId,
          question: nextQuestion,
          current_tab: window.location.hash.replace(/^#/, "") || null,
        }),
      });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json.ok) {
        setResult(null);
        setError(json.ok ? "ask_failed" : json.error);
        return;
      }
      setResult(json.answer);
    } catch {
      setResult(null);
      setError("request_failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardSection
      kicker="Ask"
      title="Ask your dashboard (no oracle cosplay)"
      subtitle="Grounded answers about this site: summary, spikes, threats, changes, performance, uptime, and what to do next."
    >
      <div className="flex flex-col gap-3">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={400}
          rows={3}
          className="w-full rounded-2xl border border-slate-200/90 bg-white/80 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-fuchsia-400/60"
          placeholder="Ask a question about this site..."
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-600">{question.trim().length}/400</span>
          <button
            type="button"
            onClick={() => askDashboard()}
            disabled={!canAsk}
            className="rounded-full border border-fuchsia-400/45 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-fuchsia-950 transition enabled:hover:bg-fuchsia-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Ask"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => askDashboard(prompt)}
            disabled={loading}
            className="rounded-full border border-slate-200/90 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-800 transition hover:border-fuchsia-400/45 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 text-sm text-rose-800">
          Unable to answer this question right now ({error}). Try again with a supported dashboard question.
        </p>
      ) : null}

      {result ? (
        <AnalystAnswerView result={result} />
      ) : (
        <p className="mt-4 text-sm text-slate-700">
          No question asked yet. Try a suggested prompt — it’s like a cheat code for not typing.
        </p>
      )}
    </DashboardSection>
  );
}

