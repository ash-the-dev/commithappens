"use client";

import { useMemo, useState } from "react";
import { AnalystAnswerView } from "@/components/dashboard/AnalystAnswerView";
import type { DashboardAnswerResult } from "@/lib/ai/types";

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
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/65">
            Ask your dashboard
          </h2>
          <p className="mt-2 text-sm text-white/65">
            Ask focused questions about summary, spikes, threats, changes, performance, uptime, or recommended actions.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={400}
          rows={3}
          className="w-full rounded-xl border border-border/70 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-brand/70"
          placeholder="Ask a question about this site..."
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/45">{question.trim().length}/400</span>
          <button
            type="button"
            onClick={() => askDashboard()}
            disabled={!canAsk}
            className="rounded-full border border-brand/60 bg-brand/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand transition enabled:hover:bg-brand/25 disabled:cursor-not-allowed disabled:opacity-50"
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
            className="rounded-full border border-border/70 bg-black/25 px-3 py-1 text-xs text-white/80 transition hover:border-brand/55 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-200/85">
          Unable to answer this question right now ({error}). Try again with a supported dashboard question.
        </p>
      ) : null}

      {result ? (
        <AnalystAnswerView result={result} />
      ) : (
        <p className="mt-4 text-sm text-white/55">
          No question asked yet. Try one of the suggested prompts for a grounded dashboard answer.
        </p>
      )}
    </section>
  );
}

