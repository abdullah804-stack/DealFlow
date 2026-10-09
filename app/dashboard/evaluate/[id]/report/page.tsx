import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";

export const dynamic = "force-dynamic";

const SECTION_ORDER = [
  "executive_summary",
  "startup_overview",
  "competitive_landscape",
  "technology_analysis",
  "market_analysis",
  "financial_analysis",
  "legal_analysis",
  "founder_evaluation",
  "debate_summary",
  "recommendation",
];

export default async function EvaluationReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;

  const evaluation = await prisma.ideaEvaluation.findFirst({
    where: { id, userId },
    include: {
      candidate: {
        include: {
          dossiers: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              decisions: {
                orderBy: { createdAt: "desc" },
                take: 1,
                include: {
                  reports: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!evaluation) notFound();

  // Not yet evaluated
  if (evaluation.status !== "complete" || !evaluation.candidate) {
    return (
      <div className="max-w-2xl">
        <div className="mb-6">
          <Link
            href={`/dashboard/evaluate/${id}`}
            className="text-[var(--color-text-low)] text-sm hover:text-[var(--color-teal)]"
          >
            ← Back to evaluation
          </Link>
        </div>
        <div className="empty-state">
          <div className="empty-icon">◌</div>
          <h3>No report yet</h3>
          <p className="text-[var(--color-text-mid)] text-sm mt-2 mb-6">
            Status: <span className="font-mono">{evaluation.status}</span>. The
            committee evaluation engine ships in Phase 6. Your interview
            answers are saved and the report will appear here once the engine
            runs.
          </p>
          {evaluation.status === "review" && (
            <Link
              href={`/dashboard/evaluate/${id}/review`}
              className="btn-primary inline-block"
            >
              Go to review
            </Link>
          )}
          {evaluation.status === "evaluating" && (
            <Link
              href={`/dashboard/evaluate/${id}/progress`}
              className="btn-primary inline-block"
            >
              View progress
            </Link>
          )}
        </div>
      </div>
    );
  }

  const dossier = evaluation.candidate.dossiers[0] ?? null;
  const decision = dossier?.decisions[0] ?? null;
  const report = decision?.reports[0] ?? null;

  if (!report) {
    return (
      <div className="max-w-2xl">
        <div className="empty-state">
          <h3>Report pending</h3>
          <p className="text-[var(--color-text-mid)] text-sm mt-2">
            The committee finished but no report was written. This shouldn&apos;t
            happen — please contact support.
          </p>
        </div>
      </div>
    );
  }

  const json = (report.reportJson ?? {}) as Record<string, unknown>;
  const starRating =
    report.starRating ?? (json.star_rating as number | undefined);
  const probability = json.probability_of_success_pct as number | undefined;
  const biggestRisk = json.biggest_risk as string | undefined;
  const biggestAdvantage = json.biggest_advantage as string | undefined;
  const checkSize = json.recommended_check_size as string | undefined;
  const stage = json.recommended_stage as string | undefined;
  const disclaimer = json.disclaimer as string | undefined;

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <Link
          href="/dashboard/evaluate"
          className="text-[var(--color-text-low)] text-sm hover:text-[var(--color-teal)]"
        >
          ← Back to evaluations
        </Link>
      </div>

      <div className="mb-8">
        <div className="eyebrow">Your evaluation</div>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-semibold">
            {report.company ?? evaluation.title}
          </h1>
          {report.decision && (
            <span
              className={
                report.decision === "INVEST" ? "badge-invest" : "badge-pass"
              }
            >
              {report.decision}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs font-mono text-[var(--color-text-low)]">
          <span>{report.createdAt.toISOString().slice(0, 10)}</span>
          {typeof report.weightedScore === "number" && (
            <>
              <span>·</span>
              <span>score {report.weightedScore.toFixed(2)}/10</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {typeof starRating === "number" && (
          <div className="stat-card">
            <div className="stat-index">Rating</div>
            <div className="stat-number text-[var(--color-amber)]">
              {starRating}/5
            </div>
            <div className="stat-label">
              {"★".repeat(starRating)}
              {"☆".repeat(5 - starRating)}
            </div>
          </div>
        )}
        {typeof probability === "number" && (
          <div className="stat-card">
            <div className="stat-index">Est. success</div>
            <div className="stat-number text-[var(--color-teal)]">
              {probability}%
            </div>
            <div className="stat-label">LLM estimate</div>
          </div>
        )}
        {checkSize && (
          <div className="stat-card">
            <div className="stat-index">Check size</div>
            <div className="stat-number text-[var(--color-violet)]">
              {checkSize}
            </div>
            <div className="stat-label">{stage ?? "Stage TBD"}</div>
          </div>
        )}
      </div>

      {(biggestRisk || biggestAdvantage) && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          {biggestAdvantage && (
            <div className="panel">
              <div className="eyebrow text-[var(--color-teal)]">
                Biggest advantage
              </div>
              <p className="text-sm text-[var(--color-text-hi)] leading-relaxed">
                {biggestAdvantage}
              </p>
            </div>
          )}
          {biggestRisk && (
            <div className="panel">
              <div className="eyebrow text-[var(--color-coral)]">
                Biggest risk
              </div>
              <p className="text-sm text-[var(--color-text-hi)] leading-relaxed">
                {biggestRisk}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-6">
        {SECTION_ORDER.map((key) => {
          const value = json[key];
          if (typeof value !== "string" || !value.trim()) return null;
          const title = key
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
          return (
            <div key={key} className="panel-lg">
              <h2 className="text-lg font-semibold mb-3">{title}</h2>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--color-text-mid)]">
                {value}
              </p>
            </div>
          );
        })}
      </div>

      {disclaimer && (
        <div className="mt-8 text-xs text-[var(--color-text-low)] italic border-t border-[var(--color-border-soft)] pt-4">
          {disclaimer}
        </div>
      )}
    </div>
  );
}