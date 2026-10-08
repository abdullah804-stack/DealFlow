import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { subDays } from "date-fns";

export const dynamic = "force-dynamic";

async function getFunnelStats(daysBack: number) {
  const cutoff = subDays(new Date(), daysBack);

  const [discovered, validated, escalated, invested, recentRuns] =
    await Promise.all([
      prisma.candidate.count({
        where: { firstSeen: { gte: cutoff } },
      }),
      prisma.candidate.count({
        where: {
          firstSeen: { gte: cutoff },
          discoveryConfidence: { gte: 5.0 },
        },
      }),
      prisma.candidate.count({
        where: {
          firstSeen: { gte: cutoff },
          dossiers: { some: {} },
        },
      }),
      prisma.candidate.count({
        where: {
          firstSeen: { gte: cutoff },
          dossiers: {
            some: {
              decisions: { some: { decision: "INVEST" } },
            },
          },
        },
      }),
      prisma.dailyRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 5,
      }),
    ]);

  return { discovered, validated, escalated, invested, recentRuns };
}

export default async function DashboardPage() {
  const stats = await getFunnelStats(30);

  return (
    <div>
      <div className="mb-8">
        <div className="eyebrow">Overview</div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-[var(--color-text-mid)] text-sm mt-2">
          Discovery and committee activity over the last 30 days.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <div className="stat-index">01</div>
          <div className="stat-number text-[var(--color-blue)]">
            {stats.discovered}
          </div>
          <div className="stat-label">Discovered</div>
        </div>
        <div className="stat-card">
          <div className="stat-index">02</div>
          <div className="stat-number text-[var(--color-amber)]">
            {stats.validated}
          </div>
          <div className="stat-label">Validated</div>
        </div>
        <div className="stat-card">
          <div className="stat-index">03</div>
          <div className="stat-number text-[var(--color-coral)]">
            {stats.escalated}
          </div>
          <div className="stat-label">Escalated</div>
        </div>
        <div className="stat-card">
          <div className="stat-index">04</div>
          <div className="stat-number text-[var(--color-teal)]">
            {stats.invested}
          </div>
          <div className="stat-label">Invested</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <Link
          href="/dashboard/discover"
          className="panel hover:border-[var(--color-teal)] transition-colors"
        >
          <div className="text-[var(--color-teal)] text-lg mb-3">▽</div>
          <h3 className="font-semibold mb-1">Discover</h3>
          <p className="text-xs text-[var(--color-text-mid)]">
            Browse all candidates from the daily pipeline
          </p>
        </Link>
        <Link
          href="/dashboard/reports"
          className="panel hover:border-[var(--color-teal)] transition-colors"
        >
          <div className="text-[var(--color-teal)] text-lg mb-3">▤</div>
          <h3 className="font-semibold mb-1">Reports</h3>
          <p className="text-xs text-[var(--color-text-mid)]">
            VC-memo writeups for committee-reviewed candidates
          </p>
        </Link>
        <Link
          href="/dashboard/evaluate"
          className="panel hover:border-[var(--color-teal)] transition-colors"
        >
          <div className="text-[var(--color-teal)] text-lg mb-3">◇</div>
          <h3 className="font-semibold mb-1">Evaluate</h3>
          <p className="text-xs text-[var(--color-text-mid)]">
            Submit your own idea to the committee
          </p>
        </Link>
        <Link
          href="/dashboard/settings"
          className="panel hover:border-[var(--color-teal)] transition-colors"
        >
          <div className="text-[var(--color-teal)] text-lg mb-3">⚙</div>
          <h3 className="font-semibold mb-1">Settings</h3>
          <p className="text-xs text-[var(--color-text-mid)]">
            Profile, privacy, and usage
          </p>
        </Link>
      </div>

      {stats.recentRuns.length > 0 && (
        <div className="panel">
          <h3 className="font-semibold mb-4">Recent daily runs</h3>
          <div className="space-y-2">
            {stats.recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between text-sm border-b border-[var(--color-border-soft)] last:border-0 pb-2 last:pb-0"
              >
                <span className="font-mono text-[var(--color-text-low)]">
                  {run.startedAt.toISOString().slice(0, 19).replace("T", " ")}
                </span>
                <span className="text-[var(--color-text-mid)]">
                  {run.candidatesFound} found · {run.candidatesEscalated} escalated
                </span>
                <span
                  className={
                    run.status === "completed"
                      ? "text-[var(--color-teal)]"
                      : run.status === "failed"
                      ? "text-[var(--color-coral)]"
                      : "text-[var(--color-amber)]"
                  }
                >
                  {run.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}