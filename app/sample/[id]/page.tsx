import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function SampleReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const report = await prisma.report.findUnique({
    where: { id },
  });

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
      <nav className="flex items-center justify-between px-6 md:px-8 py-4 md:py-6 border-b border-[var(--color-border-soft)]">
        <Logo />
        <div className="flex items-center gap-3">
          <span className="hidden md:inline text-xs text-[var(--color-text-low)] font-mono uppercase tracking-wider">
            Public sample
          </span>
          <Link href="/signup" className="btn-primary text-sm">
            Get started
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 md:px-8 py-8 md:py-12">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="eyebrow">Sample report</div>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4">
            <h1 className="text-2xl md:text-3xl font-semibold leading-snug break-words">
              {report.company ?? "Unknown company"}
            </h1>
            {report.decision && (
              <span
                className={
                  report.decision === "INVEST"
                    ? "badge-invest"
                    : "badge-pass"
                }
              >
                {report.decision}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs font-mono text-[var(--color-text-low)]">
            <span>{report.createdAt.toISOString().slice(0, 10)}</span>
            {typeof report.weightedScore === "number" && (
              <>
                <span>·</span>
                <span>score {report.weightedScore.toFixed(2)}/10</span>
              </>
            )}
          </div>
        </div>

        {/* Source info */}
        {sourceInfo && (
          <div className="panel mb-6">
            <div className="eyebrow mb-3">Source</div>
            <div className="text-sm space-y-1">
              {sourceInfo.platform_display && (
                <div>
                  <span className="text-[var(--color-text-low)]">
                    Platform:{" "}
                  </span>
                  {sourceInfo.platform_display}
                </div>
              )}
              {sourceInfo.username && (
                <div>
                  <span className="text-[var(--color-text-low)]">
                    Author:{" "}
                  </span>
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
                    className="text-[var(--color-neon)] hover:underline break-all"
                  >
                    {sourceInfo.url}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 md:mb-8">
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
              <div className="stat-number text-[var(--color-neon)]">
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

        {/* Highlight boxes */}
        {(biggestRisk || biggestAdvantage) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 md:mb-8">
            {biggestAdvantage && (
              <div className="panel">
                <div className="eyebrow text-[var(--color-neon)]">
                  Biggest advantage
                </div>
                <p className="text-sm text-[var(--color-text-hi)] leading-relaxed">
                  {biggestAdvantage}
                </p>
              </div>
            )}
            {biggestRisk && (
              <div className="panel">
                <div className="eyebrow text-[var(--color-neon-red)]">
                  Biggest risk
                </div>
                <p className="text-sm text-[var(--color-text-hi)] leading-relaxed">
                  {biggestRisk}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Sections */}
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
                <h2 className="text-base md:text-lg font-semibold mb-3">
                  {title}
                </h2>
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

        {/* CTA */}
        <div className="mt-10 md:mt-12 panel-lg text-center">
          <h2 className="text-lg md:text-xl font-semibold mb-3">
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

      {/* Footer */}
      <footer className="px-6 md:px-8 py-8 md:py-10 border-t border-[var(--color-border-soft)] mt-10 md:mt-12">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="DealFlow"
              width={24}
              height={24}
              className="rounded"
            />
            <span className="text-sm text-[var(--color-text-low)]">
              DealFlow — autonomous VC analyst
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[var(--color-text-low)]">
            <Link href="/methodology" className="hover:text-[var(--color-neon)]">
              Methodology
            </Link>
            <Link href="/privacy" className="hover:text-[var(--color-neon)]">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[var(--color-neon)]">
              Terms
            </Link>
          </div>
        </div>
        <div className="max-w-4xl mx-auto mt-6 text-center text-xs text-[var(--color-text-low)] font-mono">
          All predictions are LLM-generated estimates, not financial advice.
        </div>
      </footer>
    </main>
  );
}