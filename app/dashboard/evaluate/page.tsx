import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { PageFade } from "@/components/PageFade";

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
    <PageFade>
      {/* Header: stacked on mobile, side-by-side on desktop */}
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="eyebrow">Evaluate</div>
          <h1 className="text-2xl md:text-3xl font-semibold">
            Your submissions
          </h1>
          <p className="text-[var(--color-text-mid)] text-sm mt-2">
            Submit your own idea, answer the committee&apos;s questions, and
            get a full evaluation.
          </p>
        </div>
        <Link
          href="/dashboard/evaluate/new"
          className="btn-primary text-sm text-center md:flex-shrink-0"
        >
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
          <Link
            href="/dashboard/evaluate/new"
            className="btn-primary inline-block"
          >
            Submit an idea
          </Link>
        </div>
      ) : (
        <div className="stagger-list space-y-2">
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
                className="panel block transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-[15px] md:text-base leading-snug line-clamp-2 md:truncate">
                      {e.title}
                    </h3>
                    <p className="text-sm text-[var(--color-text-mid)] mt-1 line-clamp-2 md:line-clamp-1">
                      {e.oneLiner}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-[11px] md:text-xs text-[var(--color-text-low)] font-mono">
                      <span>{e.createdAt.toISOString().slice(0, 10)}</span>
                      <span className="text-[var(--color-border)]">·</span>
                      <span>{statusLabel}</span>
                    </div>
                  </div>
                  <span
                    className={`${
                      isComplete
                        ? "badge-invest"
                        : isFailed
                        ? "badge-pass"
                        : "font-mono text-xs text-[var(--color-text-mid)] uppercase tracking-wider"
                    } self-start md:self-center flex-shrink-0`}
                  >
                    {isComplete ? "COMPLETE" : isFailed ? "PARTIAL" : "→"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageFade>
  );
}