import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  intake: "Draft",
  interviewing: "Interviewing",
  review: "Reviewing",
  evaluating: "Evaluating",
  complete: "Complete",
  failed_partial: "Partial failure",
};

export default async function EvaluateListPage() {
  const userId = await requireUserId();

  const evaluations = await prisma.ideaEvaluation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="eyebrow">Evaluate</div>
          <h1 className="text-3xl font-semibold">Your submissions</h1>
          <p className="text-[var(--color-text-mid)] text-sm mt-2">
            Submit your own idea, answer the committee&apos;s questions, and get
            a full evaluation.
          </p>
        </div>
        <Link href="/dashboard/evaluate/new" className="btn-primary">
          New submission
        </Link>
      </div>

      {evaluations.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">◇</div>
          <h3>No submissions yet</h3>
          <p className="text-[var(--color-text-mid)] text-sm mt-2 mb-4">
            Submit your first idea to run it through the committee.
          </p>
          <Link href="/dashboard/evaluate/new" className="btn-primary inline-block">
            Submit an idea
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {evaluations.map((e) => {
            const statusLabel = STATUS_LABELS[e.status] ?? e.status;
            const isComplete = e.status === "complete";
            const isFailed = e.status === "failed_partial";

            const href =
              e.status === "intake" || e.status === "interviewing"
                ? `/dashboard/evaluate/${e.id}/interview`
                : e.status === "review"
                ? `/dashboard/evaluate/${e.id}/review`
                : e.status === "evaluating"
                ? `/dashboard/evaluate/${e.id}/progress`
                : isComplete
                ? `/dashboard/evaluate/${e.id}/report`
                : `/dashboard/evaluate/${e.id}`;

            return (
              <Link
                key={e.id}
                href={href}
                className="panel block hover:border-[var(--color-teal)] transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">{e.title}</h3>
                    <p className="text-sm text-[var(--color-text-mid)] mt-1 line-clamp-1">
                      {e.oneLiner}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-text-low)] font-mono">
                      <span>{e.createdAt.toISOString().slice(0, 10)}</span>
                      <span>·</span>
                      <span>{statusLabel}</span>
                    </div>
                  </div>
                  <span
                    className={
                      isComplete
                        ? "badge-invest"
                        : isFailed
                        ? "badge-pass"
                        : "font-mono text-xs text-[var(--color-text-mid)]"
                    }
                  >
                    {isComplete ? "COMPLETE" : isFailed ? "PARTIAL" : "→"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}