"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Turn = {
  id: string;
  turnIndex: number;
  specialist: string;
  questionKey: string;
  questionText: string;
  answerText: string | null;
  skipped: boolean;
};

type Session = {
  id: string;
  status: string;
  questionsAsked: number;
  questionsAnswered: number;
  turns: Turn[];
};

type Evaluation = {
  id: string;
  title: string;
  status: string;
};

const SPECIALIST_COLOR: Record<string, string> = {
  technical: "var(--color-blue)",
  finance: "var(--color-teal)",
  marketing: "var(--color-amber)",
  legal: "var(--color-coral)",
  founder: "var(--color-violet)",
};

export default function InterviewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/v1/idea-evaluations/${id}`);
    if (!res.ok) {
      setError("Could not load interview.");
      setLoading(false);
      return;
    }
    const body = await res.json();
    setEvaluation(body.data.evaluation);
    setSession(body.data.session);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.turns.length]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || !session) return;

    const lastTurn = [...session.turns]
      .reverse()
      .find((t) => !t.answerText && !t.skipped);
    if (!lastTurn) return;

    setSubmitting(true);
    setError("");

    const res = await fetch(
      `/api/v1/idea-evaluations/${id}/interview/answer`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turnIndex: lastTurn.turnIndex,
          answerText: answer.trim(),
        }),
      }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.message ?? "Failed to submit answer.");
      setSubmitting(false);
      return;
    }

    const body = await res.json();
    setAnswer("");

    if (body.data.complete) {
      router.push(`/dashboard/evaluate/${id}/review`);
      return;
    }

    setSubmitting(false);
    await load();
  }

  async function handleSkip() {
    if (!session) return;
    const lastTurn = [...session.turns]
      .reverse()
      .find((t) => !t.answerText && !t.skipped);
    if (!lastTurn) return;

    setSubmitting(true);
    setError("");

    const res = await fetch(`/api/v1/idea-evaluations/${id}/interview/skip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turnIndex: lastTurn.turnIndex }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.message ?? "Failed to skip.");
      setSubmitting(false);
      return;
    }

    const body = await res.json();
    if (body.data.complete) {
      router.push(`/dashboard/evaluate/${id}/review`);
      return;
    }

    setSubmitting(false);
    await load();
  }

  if (loading) {
    return <div className="loading-state">Loading interview…</div>;
  }

  if (!evaluation || !session) {
    return (
      <div className="empty-state">
        <h3>Interview not found</h3>
        <Link href="/dashboard/evaluate" className="btn-ghost inline-block mt-4">
          Back to evaluations
        </Link>
      </div>
    );
  }

  const pendingTurn = [...session.turns]
    .reverse()
    .find((t) => !t.answerText && !t.skipped);

  const answeredCount = session.turns.filter(
    (t) => t.answerText && t.answerText.trim()
  ).length;

  const noTurnsYet = session.turns.length === 0;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link
          href="/dashboard/evaluate"
          className="text-[var(--color-text-low)] text-sm hover:text-[var(--color-teal)]"
        >
          ← Save & exit
        </Link>
      </div>

      <div className="mb-6">
        <div className="eyebrow">Interview · {evaluation.title}</div>
        <h1 className="text-2xl font-semibold">Committee interview</h1>
        <p className="text-[var(--color-text-mid)] text-sm mt-1">
          {answeredCount} answered · {session.turns.length} asked · 20 required
        </p>
      </div>

      {noTurnsYet ? (
        <div className="panel text-center">
          <p className="text-[var(--color-text-mid)] text-sm mb-4">
            The first question wasn&apos;t generated when this evaluation was
            created — likely a transient LLM failure. Refresh to try again.
          </p>
          <button onClick={load} className="btn-primary">
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="panel-lg mb-6 space-y-6">
            {session.turns.map((turn) => (
              <div key={turn.id}>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="text-xs font-mono uppercase tracking-wider"
                    style={{ color: SPECIALIST_COLOR[turn.specialist] }}
                  >
                    {turn.specialist}
                  </span>
                  <span className="text-xs text-[var(--color-text-low)] font-mono">
                    #{turn.turnIndex + 1}
                  </span>
                </div>
                <p className="text-[var(--color-text-hi)] leading-relaxed mb-3">
                  {turn.questionText}
                </p>
                {turn.answerText && (
                  <div className="pl-4 border-l-2 border-[var(--color-teal)] text-[var(--color-text-mid)] text-sm leading-relaxed whitespace-pre-wrap">
                    {turn.answerText}
                  </div>
                )}
                {turn.skipped && !turn.answerText && (
                  <div className="pl-4 border-l-2 border-[var(--color-border)] text-[var(--color-text-low)] text-sm italic">
                    Skipped
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {pendingTurn ? (
            <form onSubmit={handleSubmit} className="panel">
              <label htmlFor="answer" className="field-label">
                Your answer
              </label>
              <textarea
                id="answer"
                rows={5}
                maxLength={2000}
                required
                disabled={submitting}
                className="input resize-y mb-3"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer…"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--color-text-low)] font-mono">
                  {answer.length}/2000
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSkip}
                    className="btn-ghost"
                  >
                    Skip
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !answer.trim()}
                    className="btn-primary"
                  >
                    {submitting ? "Submitting…" : "Submit"}
                  </button>
                </div>
              </div>
              {error && (
                <p className="text-[var(--color-coral)] text-sm mt-3">
                  {error}
                </p>
              )}
            </form>
          ) : (
            <div className="panel text-center">
              <p className="text-[var(--color-text-mid)] text-sm">
                Interview complete. Redirecting…
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}