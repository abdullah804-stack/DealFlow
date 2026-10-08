import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/discover"
          className="text-[var(--color-text-low)] text-sm hover:text-[var(--color-teal)]"
        >
          ← Back to discover
        </Link>
      </div>

      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="eyebrow">Candidate</div>
          <h1 className="text-3xl font-semibold mb-2">{candidate.title}</h1>
          <div className="flex items-center gap-3 text-xs font-mono text-[var(--color-text-low)]">
            <span>{candidate.source}</span>
            <span>·</span>
            <span>{candidate.firstSeen.toISOString().slice(0, 10)}</span>
            {candidate.url && (
              <>
                <span>·</span>
                <a
                  href={candidate.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-teal)] hover:underline"
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

      <div className="grid grid-cols-[2fr_1fr] gap-6">
        <div className="space-y-6">
          {dossier && (
            <div className="panel-lg">
              <h2 className="text-lg font-semibold mb-4">Dossier</h2>
              <div className="space-y-3 text-sm">
                {Object.entries(dossier.dossierJson as Record<string, unknown>).map(
                  ([key, value]) => (
                    <div key={key} className="grid grid-cols-[140px_1fr] gap-4">
                      <span className="text-[var(--color-text-low)] font-mono text-xs uppercase tracking-wide pt-0.5">
                        {key.replace(/_/g, " ")}
                      </span>
                      <span className="text-[var(--color-text-hi)]">
                        {Array.isArray(value)
                          ? value.length > 0
                            ? value.join(", ")
                            : "—"
                          : value === null || value === undefined || value === ""
                          ? "—"
                          : String(value)}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {decision?.debateSummary && (
            <div className="panel-lg">
              <h2 className="text-lg font-semibold mb-4">Committee debate</h2>
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
                  <span className="text-[var(--color-text-low)]">Weighted score</span>
                  <span className="font-mono">
                    {decision.weightedScore.toFixed(2)}/10
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-low)]">Fast path</span>
                  <span className="font-mono">{decision.fastPath ?? "none"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-low)]">Rubric</span>
                  <span className="font-mono">{decision.rubricVersion}</span>
                </div>
              </div>
            </div>
          )}

          {round1.length > 0 && (
            <div className="panel">
              <h3 className="font-semibold mb-4">Round 1 — assessments</h3>
              <div className="space-y-3">
                {round1.map((a) => (
                  <div key={a.id} className="text-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium capitalize">{a.agentType}</span>
                      <span className="font-mono text-[var(--color-text-mid)]">
                        {a.score.toFixed(1)}/10
                      </span>
                    </div>
                    <div className="h-1 bg-[var(--color-border-soft)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--color-teal)]"
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
              <h3 className="font-semibold mb-4">Round 2 — reflections</h3>
              <div className="space-y-3">
                {round2.map((a) => (
                  <div key={a.id} className="text-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium capitalize">{a.agentType}</span>
                      <span className="font-mono text-[var(--color-text-mid)]">
                        {a.score.toFixed(1)}/10
                      </span>
                    </div>
                    <div className="h-1 bg-[var(--color-border-soft)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--color-coral)]"
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
    </div>
  );
}