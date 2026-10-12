"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

const SUGGESTIONS = [
  "How did traffic change vs the previous period?",
  "Which countries drove the most visitors?",
  "Which links got the most clicks?",
  "Where should I focus to grow conversions?",
];

export function AnalyticsAssistant({ range, available }: { range: string; available: boolean }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [credits, setCredits] = useState<number | null | undefined>(undefined);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setBusy(true);
    setError("");
    setAnswer("");
    try {
      const res = await fetch("/api/analytics/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, range }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setError(j?.error?.message || "The assistant couldn't answer just now.");
        return;
      }
      setAnswer(j.data.answer);
      setCredits(j.data.creditsRemaining);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-white">
          <Sparkles className="h-4 w-4 text-brand-500" /> Ask your data
        </h2>
        {credits !== undefined && credits !== null && (
          <span className="text-xs text-night-400">{credits} credits left</span>
        )}
      </div>

      {!available ? (
        <p className="text-sm text-night-400">The analytics assistant isn&apos;t enabled on this workspace.</p>
      ) : (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(question);
            }}
            className="flex gap-2"
          >
            <input
              className="input"
              placeholder="Ask about your traffic, links or conversions…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={500}
              aria-label="Ask the analytics assistant"
            />
            <button type="submit" className="btn-primary !px-4" disabled={busy || question.trim().length < 3}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}
            </button>
          </form>

          <div className="mt-2 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => {
                  setQuestion(s);
                  void ask(s);
                }}
                className="rounded-full border border-night-600 px-3 py-1 text-xs text-night-300 hover:border-night-500 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          {answer && (
            <div className="mt-3 rounded-xl border border-night-700 bg-night-950 p-4 text-sm leading-relaxed text-night-100">
              {answer}
            </div>
          )}
        </>
      )}
    </div>
  );
}
