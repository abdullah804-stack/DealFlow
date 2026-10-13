import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageFade } from "@/components/PageFade";

export const dynamic = "force-dynamic";

/**
 * Extracts just the domain from a source string.
 * RSS sources are full URLs; HN/Reddit/YC are short names.
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
    <PageFade>
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="eyebrow">Pipeline</div>
        <h1 className="text-2xl md:text-3xl font-semibold">Discover</h1>
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
        <div className="stagger-list space-y-2">
          {candidates.map((c) => {
            const dossier = c.dossiers[0];
            const decision = dossier?.decisions[0];
            const source = sourceLabel(c.source);
            const date = c.firstSeen.toISOString().slice(0, 10);

            return (
              <Link
                key={c.id}
                href={`/dashboard/discover/${c.id}`}
                className="panel block hover:border-[var(--color-neon)] transition-colors"
              >
                {/* Mobile: vertical stack. Desktop: horizontal row. */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  {/* Left: title + metadata */}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-[15px] md:text-base leading-snug line-clamp-2 md:truncate">
                      {c.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-[11px] md:text-xs text-[var(--color-text-low)] font-mono">
                      <span className="truncate max-w-[140px] md:max-w-none">
                        {source}
                      </span>

                      {c.discoveryConfidence !== null && (
                        <>
                          <span className="text-[var(--color-border)]">·</span>
                          <span>
                            conf {c.discoveryConfidence.toFixed(1)}
                          </span>
                        </>
                      )}

                      <span className="text-[var(--color-border)]">·</span>
                      <span>{date}</span>
                    </div>
                  </div>

                  {/* Right: decision badge + arrow */}
                  <div className="flex items-center justify-between md:justify-end gap-3 md:flex-shrink-0">
                    {decision ? (
                      <span
                        className={
                          decision.decision === "INVEST"
                            ? "badge-invest"
                            : "badge-pass"
                        }
                      >
                        {decision.decision}
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-[var(--color-text-low)] uppercase tracking-wider">
                        pending
                      </span>
                    )}
                    <span className="text-[var(--color-text-low)] hidden md:inline">
                      →
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageFade>
  );
}