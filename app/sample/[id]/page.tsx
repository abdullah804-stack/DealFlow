import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Public read-only view of a discovery report.
 *
 * Only shows reports where subjectType = "candidate".
 * Idea-evaluation reports stay private.
 */
export default async function SampleReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const report = await prisma.report.findUnique({
    where: { id },
  });

  // Only discovery reports are publicly viewable
  if (!report || report.subjectType !== "candidate") {
    notFound();
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
  const sourceInfo = json.source_info as
    | {
        platform_display?: string;
        username?: string;
        url?: string;
      }
    | undefined;

  const sectionOrder = [
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

  return (
    <main className="relative z-10 min-h-screen">
      <nav className="flex items-center justify-between px-8 py-6 border-b border-[var(--color-border-soft)]">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-[var(--color-teal)] text-xl">⬡</span>
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-[15px]">DealFlow</span>
            <span className="font-mono text-[10px] text-[var(--color-text-low)] uppercase tracking-wider">
              deal intelligence
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--color-text-low)] font-mono">
            Public sample
          </span>
          <Link href="/signup" className="btn-primary text-sm">
            Get started
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-8 py-12">
        <div className="mb-8">
          <div className="eyebrow">Sample report</div>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-semibold">
              {report.company ?? "Unknown company"}
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

        {sourceInfo && (
          <div className="panel mb-6">
            <div className="eyebrow mb-3">Source</div>
            <div className="text-sm space-y-1">
              {sourceInfo.platform_display && (
                <div>
                  <span className="text-[var(--color-text-low)]">Platform: </span>
                  {sourceInfo.platform_display}
                </div>
              )}
              {sourceInfo.username && (
                <div>
                  <span className="text-[var(--color-text-low)]">Author: </span>
                  {sourceInfo.username}
                </div>
              )}
              {sourceInfo.url && (
                <div>
                  <span className="text-[var(--color-text-low)]">URL: </span>
                  <a
                    href={sourceInfo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-teal)] hover:underline break-all"
                  >
                    {sourceInfo.url}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

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
          {sectionOrder.map((key) => {
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

        <div className="mt-12 panel-lg text-center">
          <h2 className="text-xl font-semibold mb-3">
            Want reports like this on your own idea?
          </h2>
          <p className="text-sm text-[var(--color-text-mid)] mb-5 max-w-lg mx-auto">
            Submit your idea, answer 25 questions from our investment
            committee, and get a full evaluation — same rubric as the
            discovery pipeline.
          </p>
          <Link href="/signup" className="btn-primary inline-block">
            Try it free
          </Link>
        </div>
      </div>

      <footer className="px-8 py-6 border-t border-[var(--color-border-soft)] text-center mt-12">
        <p className="text-[var(--color-text-low)] text-xs">
          All predictions are LLM-generated estimates, not financial advice.
        </p>
      </footer>
    </main>
  );
}