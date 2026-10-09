"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Status = {
  id: string;
  status: string;
  failureReason: string | null;
  progress: { step?: string; percent?: number } | null;
  decision: string | null;
  reportId: string | null;
};

const POLL_INTERVAL_MS = 3000;

export default function ProgressPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const poll = useCallback(async () => {
    const res = await fetch(
      `/api/v1/idea-evaluations/${id}/evaluation/status`
    );
    if (!res.ok) {
      setError("Could not reach evaluation status.");
      setLoading(false);
      return null;
    }
    const body = await res.json();
    const data = body.data as Status;
    setStatus(data);
    setLoading(false);
    return data;
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      const data = await poll();
      if (cancelled) return;

      if (data?.status === "complete") {
        router.push(`/dashboard/evaluate/${id}/report`);
        return;
      }
      if (data?.status === "failed_partial") {
        return; // stop polling, show error state
      }
      if (data?.status === "evaluating") {
        setTimeout(tick, POLL_INTERVAL_MS);
      }
      // any other status: don't keep polling
    }

    tick();
    return () => {
      cancelled = true;
    };
  }, [poll, router, id]);

  if (loading) {
    return <div className="loading-state">Loading evaluation…</div>;
  }

  if (error) {
    return (
      <div className="empty-state">
        <h3>{error}</h3>
        <Link href="/dashboard/evaluate" className="btn-ghost inline-block mt-4">
          Back to evaluations
        </Link>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="empty-state">
        <h3>Evaluation not found</h3>
        <Link href="/dashboard/evaluate" className="btn-ghost inline-block mt-4">
          Back to evaluations
        </Link>
      </div>
    );
  }

  if (status.status === "failed_partial") {
    return (
      <div className="max-w-2xl">
        <div className="eyebrow">Evaluation</div>
        <h1 className="text-3xl font-semibold mb-4">Something went wrong</h1>
        <div className="panel-lg">
          <p className="text-sm text-[var(--color-text-mid)] leading-relaxed mb-4">
            {status.failureReason ??
              "The committee run failed. Your interview answers are saved — you can retry."}
          </p>
          <Link href="/dashboard/evaluate" className="btn-ghost inline-block">
            Back to evaluations
          </Link>
        </div>
      </div>
    );
  }

  const step = status.progress?.step ?? "Waiting for committee";

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <div className="eyebrow">Evaluation in progress</div>
        <h1 className="text-3xl font-semibold">The committee is running</h1>
        <p className="text-[var(--color-text-mid)] text-sm mt-2">
          Five specialist agents are evaluating your idea, debating their
          findings, and voting. This usually takes a few minutes.
        </p>
      </div>

      <div className="panel-lg">
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-10 h-10 rounded-full border-2 border-[var(--color-teal)] border-t-transparent animate-spin"
            aria-hidden
          />
          <div>
            <div className="font-medium">{step}</div>
            <div className="text-xs text-[var(--color-text-low)] font-mono">
              Status: {status.status}
            </div>
          </div>
        </div>

        <div className="h-1 bg-[var(--color-border-soft)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-teal)] transition-all duration-500"
            style={{ width: `${status.progress?.percent ?? 15}%` }}
          />
        </div>

        <p className="text-xs text-[var(--color-text-low)] mt-6">
          The evaluation engine runs in the background. You can close this page
          and come back later — results will be on the report page.
        </p>
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/dashboard/evaluate"
          className="text-sm text-[var(--color-text-low)] hover:text-[var(--color-teal)]"
        >
          ← Back to evaluations
        </Link>
      </div>
    </div>
  );
}