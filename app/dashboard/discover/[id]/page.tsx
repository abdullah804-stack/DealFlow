import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Shortens a source string to just the domain if it's a URL.
 * RSS sources are full feed URLs; HN/Reddit/YC are short names.
 */
function sourceLabel(source: string): string {
  if (!source) return "unknown";
  try {
    if (source.startsWith("http")) {
      const url = new URL(source);
      return url.hostname.replace(/^www\./, "");
    }
  } catch {
    // fall through
  }
  return source;
}

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      dossiers: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          decisions: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      assessments: {
        orderBy: [{ round: "asc" }, { agentType: "asc" }],
      },
    },
  });

  if (!candidate) notFound();

  const dossier = candidate.dossiers[0] ?? null;
  const decision = dossier?.decisions[0] ?? null;

  const round1 = candidate.assessments.filter((a) => a.round === 1);
  const round2 = candidate.assessments.filter((a) => a.round === 2);

  const hasAnyAnalysis = dossier !== null;

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/discover"
          className="text-[var(--color-text-low)] text-sm hover:text-[var(--color-neon)]"
        >
          ← Back to discover
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4">
        <div className="min-w-0">
          <div className="eyebrow">Candidate</div>
          <h1 className="text-2xl md:text-3xl font-semibold mb-2 leading-snug break-words">
            {candidate.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-[var(--color-text-low)]">
            <span>{sourceLabel(candidate.source)}</span>
            <span>·</span>
            <span>{candidate.firstSeen.toISOString().slice(0, 10)}</span>
            {candidate.url && (
              <>
                <span>·</span>
                <a
                  href={candidate.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-neon)] hover:underline"
                >
                  original source ↗
                </a>
              </>
            )}
          </div>
        </div>
        {decision && (
          <span
            className={
              decision.decision === "INVEST" ? "badge-invest" : "badge-pass"
            }
          >
            {decision.decision}
          </span>
        )}
      </div>

      {/* Empty state — no dossier built */}
      {!hasAnyAnalysis && (
        <div className="empty-state max-w-2xl">
          <div className="empty-icon">◌</div>
          <h3>Not escalated to committee</h3>
          <p className="text-[var(--color-text-mid)] text-sm mt-2 mb-4">
            This candidate was discovered but did not clear the validation
            threshold on {candidate.firstSeen.toISOString().slice(0, 10)}.
            It was not run through the full committee, so there is no dossier
            or report for it.
          </p>
          <Link
            href="/dashboard/discover"
            className="btn-ghost inline-block"
          >
            ← Back to discover
          </Link>
        </div>
      )}

      {/* Content: single column on mobile, 2 columns on desktop */}
      {hasAnyAnalysis && (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          <div className="space-y-6">
            {dossier && (
              <div className="panel-lg">
                <h2 className="text-lg font-semibold mb-4">Dossier</h2>
                <div className="space-y-3 text-sm">
                  {Object.entries(
                    dossier.dossierJson as Record<string, unknown>
                  ).map(([key, value]) => (
                    <div
                      key={key}
                      className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-1 md:gap-4"
                    >
                      <span className="text-[var(--color-text-low)] font-mono text-xs uppercase tracking-wide">
                        {key.replace(/_/g, " ")}
                      </span>
                      <span className="text-[var(--color-text-hi)] break-words">
                        {Array.isArray(value)
                          ? value.length > 0
                            ? value.join(", ")
                            : "—"
                          : value === null ||
                            value === undefined ||
                            value === ""
                          ? "—"
                          : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {decision?.debateSummary && (
              <div className="panel-lg">
                <h2 className="text-lg font-semibold mb-4">
                  Committee debate
                </h2>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--color-text-mid)]">
                  {decision.debateSummary}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {decision && (
              <div className="panel">
                <h3 className="font-semibold mb-4">Final decision</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-low)]">
                      Weighted score
                    </span>
                    <span className="font-mono">
                      {decision.weightedScore.toFixed(2)}/10
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-low)]">
                      Fast path
                    </span>
                    <span className="font-mono">
                      {decision.fastPath ?? "none"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-low)]">
                      Rubric
                    </span>
                    <span className="font-mono">
                      {decision.rubricVersion}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {round1.length > 0 && (
              <div className="panel">
                <h3 className="font-semibold mb-4">
                  Round 1 — assessments
                </h3>
                <div className="space-y-3">
                  {round1.map((a) => (
                    <div key={a.id} className="text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium capitalize">
                          {a.agentType}
                        </span>
                        <span className="font-mono text-[var(--color-text-mid)]">
                          {a.score.toFixed(1)}/10
                        </span>
                      </div>
                      <div className="h-1 bg-[var(--color-border-soft)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-neon)]"
                          style={{ width: `${(a.score / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {round2.length > 0 && (
              <div className="panel">
                <h3 className="font-semibold mb-4">
                  Round 2 — reflections
                </h3>
                <div className="space-y-3">
                  {round2.map((a) => (
                    <div key={a.id} className="text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium capitalize">
                          {a.agentType}
                        </span>
                        <span className="font-mono text-[var(--color-text-mid)]">
                          {a.score.toFixed(1)}/10
                        </span>
                      </div>
                      <div className="h-1 bg-[var(--color-border-soft)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-neon-red)]"
                          style={{ width: `${(a.score / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}