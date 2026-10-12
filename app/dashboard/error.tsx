"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console in dev; in production this would go to Sentry or similar
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto py-16">
      <div className="panel-lg text-center">
        <div className="text-4xl mb-4 text-[var(--color-coral)]">◌</div>
        <h1 className="text-2xl font-semibold mb-3">
          Something went wrong
        </h1>
        <p className="text-sm text-[var(--color-text-mid)] leading-relaxed mb-6">
          {error.message || "An unexpected error occurred while loading this page."}
        </p>
        {error.digest && (
          <p className="text-xs text-[var(--color-text-low)] font-mono mb-6">
            Reference: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button onClick={reset} className="btn-primary">
            Try again
          </button>
          <Link href="/dashboard" className="btn-ghost inline-block">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}