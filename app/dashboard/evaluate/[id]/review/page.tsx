"use client";

import { useEffect, useState } from "react";
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

export default function ReviewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/v1/idea-evaluations/${id}`);
    if (!res.ok) {
      setError("Could not load evaluation.");
      setLoading(false);
      return;
    }
    const body = await res.json();
    setEvaluation(body.data.evaluation);
    setTurns(body.data.session?.turns ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveAnswer(turnId: string, answerText: string) {
    setSaving(turnId);
    setError("");
    const res = await fetch(
      `/api/v1/idea-evaluations/${id}/interview/review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnId, answerText }),
      }
    );
    setSaving(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.message ?? "Failed to save.");
      return;
    }
    await load();
  }

  async function handleFinalize() {
    setStarting(true);
    setError("");
    const res = await fetch(
      `/api/v1/idea-evaluations/${id}/evaluation/start`,
      { method: "POST" }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.message ?? "Failed to start evaluation.");
      setStarting(false);
      return;
    }
    router.push(`/dashboard/evaluate/${id}/progress`);
  }

  if (loading) {
    return <div className="loading-state">Loading review…</div>;
  }

  if (!evaluation) {
    return (
      <div className="empty-state">
        <h3>Evaluation not found</h3>
        <Link href="/dashboard/evaluate" className="btn-ghost inline-block mt-4">
          Back to evaluations
        </Link>
      </div>
    );
  }

  const answered = turns.filter((t) => t.answerText && t.answerText.trim());
  const skipped = turns.filter((t) => t.skipped && !t.answerText);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link
          href={`/dashboard/evaluate/${id}/interview`}
          className="text-[var(--color-text-low)] text-sm hover:text-[var(--color-teal)]"
        >
          ← Back to interview
        </Link>
      </div>

      <div className="mb-8">
        <div className="eyebrow">Review · {evaluation.title}</div>
        <h1 className="text-3xl font-semibold">Review your answers</h1>
        <p className="text-[var(--color-text-mid)] text-sm mt-2">
          Edit any answer before the committee runs. {answered.length} answered
          {skipped.length > 0 && `, ${skipped.length} skipped`}.
        </p>
      </div>

      <div className="space-y-4 mb-8">
        {turns.map((turn) => (
          <TurnEditor
            key={turn.id}
            turn={turn}
            saving={saving === turn.id}
            onSave={(text) => saveAnswer(turn.id, text)}
          />
        ))}
      </div>

      {error && (
        <p className="text-[var(--color-coral)] text-sm mb-4">{error}</p>
      )}

      <div className="panel-lg text-center">
        <h3 className="font-semibold mb-2">Ready for evaluation?</h3>
        <p className="text-sm text-[var(--color-text-mid)] mb-4">
          The committee will run five specialist assessments plus a full
          debate. This may take 3–5 minutes.
        </p>
        <button
          onClick={handleFinalize}
          disabled={starting || answered.length === 0}
          className="btn-primary"
        >
          {starting ? "Starting committee…" : "Run committee evaluation"}
        </button>
      </div>
    </div>
  );
}

function TurnEditor({
  turn,
  saving,
  onSave,
}: {
  turn: Turn;
  saving: boolean;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState(turn.answerText ?? "");
  const [editing, setEditing] = useState(false);

  const dirty = text !== (turn.answerText ?? "");

  return (
    <div className="panel">
      <div className="flex items-center gap-2 mb-2">
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
      <p className="text-sm text-[var(--color-text-hi)] leading-relaxed mb-3">
        {turn.questionText}
      </p>

      {editing ? (
        <>
          <textarea
            rows={4}
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="input resize-y mb-2"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setText(turn.answerText ?? "");
                setEditing(false);
              }}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={() => {
                onSave(text);
                setEditing(false);
              }}
              className="btn-primary"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="pl-4 border-l-2 border-[var(--color-teal)] text-[var(--color-text-mid)] text-sm leading-relaxed whitespace-pre-wrap mb-2">
            {turn.answerText || (
              <span className="italic text-[var(--color-text-low)]">
                Skipped
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-mono text-[var(--color-teal)] hover:underline"
          >
            {turn.answerText ? "Edit" : "Add answer"}
          </button>
        </>
      )}
    </div>
  );
}