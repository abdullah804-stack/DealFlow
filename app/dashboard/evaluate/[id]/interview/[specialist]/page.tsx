"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Spinner } from "@/components/Spinner";
import {
  AgentSidebar,
  ProgressStrip,
  QuestionCard,
  SPECIALIST_META,
  SPECIALIST_ORDER,
  type SpecialistKey,
  type SpecialistProgress,
} from "@/components/interview/InterviewUI";

type Turn = {
  id: string;
  turnIndex: number;
  specialist: string;
  questionKey: string;
  questionText: string;
  answerText: string | null;
  skipped: boolean;
};

type EvaluationData = {
  evaluation: { id: string; title: string; status: string };
  session: {
    id: string;
    status: string;
    turns: Turn[];
  } | null;
};

const FALLBACK_PROGRESS: SpecialistProgress = {
  technical: { answered: 0, total: 0, complete: false },
  finance: { answered: 0, total: 0, complete: false },
  marketing: { answered: 0, total: 0, complete: false },
  legal: { answered: 0, total: 0, complete: false },
  founder: { answered: 0, total: 0, complete: false },
};

export default function SpecialistInterviewPage() {
  const router = useRouter();
  const params = useParams<{ id: string; specialist: string }>();
  const evaluationId = params.id;
  const rawSpecialist = params.specialist;

  const specialist = useMemo(() => {
    return SPECIALIST_ORDER.includes(rawSpecialist as SpecialistKey)
      ? (rawSpecialist as SpecialistKey)
      : null;
  }, [rawSpecialist]);

  const [data, setData] = useState<EvaluationData | null>(null);
  const [progress, setProgress] = useState<SpecialistProgress>(FALLBACK_PROGRESS);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/idea-evaluations/${evaluationId}`);
    if (!res.ok) {
      setError("Could not load interview.");
      setLoading(false);
      return;
    }
    const body = await res.json();
    setData(body.data);
    setLoading(false);

    // If the evaluation moved past interviewing, route accordingly
    if (body.data.evaluation.status === "review") {
      router.push(`/dashboard/evaluate/${evaluationId}/review`);
    }
  }, [evaluationId, router]);

  useEffect(() => {
    if (!specialist) {
      router.push(`/dashboard/evaluate/${evaluationId}/interview`);
      return;
    }
    load();
  }, [specialist, evaluationId, load, router]);

  // Derived data for this specialist
  const thisSpecialistTurns = useMemo(() => {
    if (!data?.session || !specialist) return [];
    return data.session.turns.filter((t) => t.specialist === specialist);
  }, [data, specialist]);

  const pendingTurn = useMemo(
    () => [...thisSpecialistTurns].reverse().find((t) => !t.answerText && !t.skipped),
    [thisSpecialistTurns]
  );

  const answeredCount = thisSpecialistTurns.filter(
    (t) => t.answerText && t.answerText.trim().length > 0
  ).length;

  const questionIndex = Math.min(answeredCount + 1, 5);

  // Redirect to the next specialist when this one is exhausted
  useEffect(() => {
    if (!data || !specialist || loading) return;
    if (thisSpecialistTurns.length === 0) return;

    const allDone = thisSpecialistTurns.every(
      (t) => t.answerText || t.skipped
    );
    if (!allDone) return;

    // Find the next specialist that still has work
    const idx = SPECIALIST_ORDER.indexOf(specialist);
    const next = SPECIALIST_ORDER.slice(idx + 1).find((key) => {
      const forThis = data.session?.turns.filter((t) => t.specialist === key) ?? [];
      const done = forThis.length >= 5 && forThis.every((t) => t.answerText || t.skipped);
      return !done;
    });

    if (next) {
      router.push(`/dashboard/evaluate/${evaluationId}/interview/${next}`);
    } else {
      router.push(`/dashboard/evaluate/${evaluationId}/review`);
    }
  }, [data, specialist, thisSpecialistTurns, loading, router, evaluationId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingTurn || !answer.trim()) return;

    setSubmitting(true);
    setError("");

    const res = await fetch(
      `/api/v1/idea-evaluations/${evaluationId}/interview/answer`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turnIndex: pendingTurn.turnIndex,
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
    setSubmitting(false);

    if (body.data?.progress?.specialistProgress) {
      setProgress(body.data.progress.specialistProgress);
    }

    if (body.data?.complete) {
      router.push(`/dashboard/evaluate/${evaluationId}/review`);
      return;
    }

    await load();
  }

  async function handleSkip() {
    if (!pendingTurn) return;

    setSubmitting(true);
    setError("");

    const res = await fetch(
      `/api/v1/idea-evaluations/${evaluationId}/interview/skip`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnIndex: pendingTurn.turnIndex }),
      }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.message ?? "Failed to skip.");
      setSubmitting(false);
      return;
    }

    const body = await res.json();
    setSubmitting(false);

    if (body.data?.progress?.specialistProgress) {
      setProgress(body.data.progress.specialistProgress);
    }

    if (body.data?.complete) {
      router.push(`/dashboard/evaluate/${evaluationId}/review`);
      return;
    }

    await load();
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="loading-state">Loading interview…</div>
      </div>
    );
  }

  if (!specialist) {
    return (
      <div className="empty-state max-w-xl mx-auto">
        <h3>Unknown specialist</h3>
        <Link
          href={`/dashboard/evaluate/${evaluationId}/interview`}
          className="btn-ghost inline-block mt-4"
        >
          Back to interview
        </Link>
      </div>
    );
  }

  const meta = SPECIALIST_META[specialist];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Save & exit */}
      <div className="mb-6">
        <Link
          href="/dashboard/evaluate"
          className="text-[var(--color-text-low)] text-sm hover:text-[var(--color-neon)]"
        >
          ← Save & exit
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="eyebrow">Interview</div>
        <h1 className="text-2xl md:text-3xl font-semibold mb-1">
          {data?.evaluation.title}
        </h1>
        <p className="text-sm text-[var(--color-text-mid)]">
          {meta.name} · {meta.title}
        </p>
      </div>

      {/* Progress strip */}
      <ProgressStrip
        evaluationId={evaluationId}
        currentSpecialist={specialist}
        progress={progress}
      />

      {/* Two-column layout: agent left, question right */}
      <div className="grid md:grid-cols-[280px_1fr] gap-6">
        <div className="hidden md:block">
          <AgentSidebar
            specialist={specialist}
            questionIndex={questionIndex}
            totalQuestions={5}
          />
        </div>

        <div className="space-y-6">
          {pendingTurn ? (
            <>
              <QuestionCard
                questionText={pendingTurn.questionText}
                specialist={specialist}
                questionIndex={questionIndex}
                totalQuestions={5}
              />

              <form onSubmit={handleSubmit} className="panel">
                <label htmlFor="answer" className="field-label">
                  Your answer
                </label>
                <textarea
                  id="answer"
                  rows={6}
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
                      {submitting ? (
                        <span className="inline-flex items-center gap-2">
                          <Spinner size={14} />
                          Submitting…
                        </span>
                      ) : (
                        "Submit"
                      )}
                    </button>
                  </div>
                </div>
                {error && (
                  <p className="text-[var(--color-coral)] text-sm mt-3">
                    {error}
                  </p>
                )}
              </form>
            </>
          ) : (
            <div className="panel text-center py-12">
              <Spinner size={18} />
              <p className="text-sm text-[var(--color-text-mid)] mt-4">
                {meta.name} is done. Moving to next specialist…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}