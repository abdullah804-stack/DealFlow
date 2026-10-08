import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const candidates = await prisma.candidate.findMany({
    orderBy: { firstSeen: "desc" },
    take: 100,
    include: {
      dossiers: {
        take: 1,
        orderBy: { createdAt: "desc" },
        include: {
          decisions: {
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  return (
    <div>
      <div className="mb-8">
        <div className="eyebrow">Pipeline</div>
        <h1 className="text-3xl font-semibold">Discover</h1>
        <p className="text-[var(--color-text-mid)] text-sm mt-2">
          Every candidate from the daily pipeline. {candidates.length} total.
        </p>
      </div>

      {candidates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">◌</div>
          <h3>No candidates yet</h3>
          <p className="text-[var(--color-text-mid)] text-sm mt-2">
            The daily cycle runs at 06:00 UTC. Candidates will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {candidates.map((c) => {
            const dossier = c.dossiers[0];
            const decision = dossier?.decisions[0];
            return (
              <Link
                key={c.id}
                href={`/dashboard/discover/${c.id}`}
                className="panel block hover:border-[var(--color-teal)] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">{c.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-low)] font-mono">
                      <span>{c.source}</span>
                      {c.discoveryConfidence !== null && (
                        <span>confidence: {c.discoveryConfidence.toFixed(1)}</span>
                      )}
                      <span>{c.firstSeen.toISOString().slice(0, 10)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {decision && (
                      <span
                        className={
                          decision.decision === "INVEST"
                            ? "badge-invest"
                            : "badge-pass"
                        }
                      >
                        {decision.decision}
                      </span>
                    )}
                    <span className="text-[var(--color-text-low)]">→</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}