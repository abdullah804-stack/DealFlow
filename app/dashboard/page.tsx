import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { subDays } from "date-fns";
import { CountUp } from "@/components/CountUp";
import { PageFade } from "@/components/PageFade";

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

async function getTodaysPick() {
  const cutoff = subDays(new Date(), 1);

  const report = await prisma.report.findFirst({
    where: {
      subjectType: "candidate",
      createdAt: { gte: cutoff },
    },
    orderBy: { weightedScore: "desc" },
    include: {
      candidate: {
        select: {
          id: true,
          title: true,
          url: true,
          source: true,
          firstSeen: true,
        },
      },
    },
  });

  return report;
}

export default async function DashboardPage() {
  const [stats, todaysPick] = await Promise.all([
    getFunnelStats(30),
    getTodaysPick(),
  ]);

  return (
    <PageFade>
      <div className="mb-8">
        <div className="eyebrow">Overview</div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-[var(--color-text-mid)] text-sm mt-2">
          Discovery and committee activity over the last 30 days.
        </p>
      </div>

      <TodaysPickCard report={todaysPick} />

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <div className="stat-index">01</div>
          <div className="stat-number text-[var(--color-blue)]">
            <CountUp value={stats.discovered} />
          </div>
          <div className="stat-label">Discovered</div>
        </div>
        <div className="stat-card">
          <div className="stat-index">02</div>
          <div className="stat-number text-[var(--color-amber)]">
            <CountUp value={stats.validated} />
          </div>
          <div className="stat-label">Validated</div>
        </div>
        <div className="stat-card">
          <div className="stat-index">03</div>
          <div className="stat-number text-[var(--color-neon-red)]">
            <CountUp value={stats.escalated} />
          </div>
          <div className="stat-label">Escalated</div>
        </div>
        <div className="stat-card">
          <div className="stat-index">04</div>
          <div className="stat-number text-[var(--color-neon)]">
            <CountUp value={stats.invested} />
          </div>
          <div className="stat-label">Invested</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <Link
          href="/dashboard/discover"
          className="panel hover:border-[var(--color-neon)] transition-colors"
        >
          <div className="text-[var(--color-neon)] text-lg mb-3">▽</div>
          <h3 className="font-semibold mb-1">Discover</h3>
          <p className="text-xs text-[var(--color-text-mid)]">
            Browse all candidates from the daily pipeline
          </p>
        </Link>
        <Link
          href="/dashboard/reports"
          className="panel hover:border-[var(--color-neon)] transition-colors"
        >
          <div className="text-[var(--color-neon)] text-lg mb-3">▤</div>
          <h3 className="font-semibold mb-1">Reports</h3>
          <p className="text-xs text-[var(--color-text-mid)]">
            VC-memo writeups for committee-reviewed candidates
          </p>
        </Link>
        <Link
          href="/dashboard/evaluate"
          className="panel hover:border-[var(--color-neon)] transition-colors"
        >
          <div className="text-[var(--color-neon)] text-lg mb-3">◇</div>
          <h3 className="font-semibold mb-1">Evaluate</h3>
          <p className="text-xs text-[var(--color-text-mid)]">
            Submit your own idea to the committee
          </p>
        </Link>
        <Link
          href="/dashboard/settings"
          className="panel hover:border-[var(--color-neon)] transition-colors"
        >
          <div className="text-[var(--color-neon)] text-lg mb-3">⚙</div>
          <h3 className="font-semibold mb-1">Settings</h3>
          <p className="text-xs text-[var(--color-text-mid)]">
            Profile, privacy, and usage
          </p>
        </Link>
      </div>

      {stats.recentRuns.length > 0 && (
        <div className="panel">
          <h3 className="font-semibold mb-4">Recent daily runs</h3>
          <div className="stagger-list space-y-2">
            {stats.recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between text-sm border-b border-[var(--color-border-soft)] last:border-0 pb-2 last:pb-0"
              >
                <span className="font-mono text-[var(--color-text-low)]">
                  {run.startedAt.toISOString().slice(0, 19).replace("T", " ")}
                </span>
                <span className="text-[var(--color-text-mid)]">
                  {run.candidatesFound} found · {run.candidatesEscalated}{" "}
                  escalated
                </span>
                <span
                  className={
                    run.status === "completed"
                      ? "text-[var(--color-neon)]"
                      : run.status === "failed"
                      ? "text-[var(--color-neon-red)]"
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
    </PageFade>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Today's Pick
// ═══════════════════════════════════════════════════════════════════

type TodaysPickReport = {
  id: string;
  company: string | null;
  decision: string | null;
  weightedScore: number | null;
  starRating: number | null;
  reportJson: unknown;
  createdAt: Date;
  candidate: {
    id: string;
    title: string;
    url: string;
    source: string;
    firstSeen: Date;
  } | null;
} | null;

function TodaysPickCard({ report }: { report: TodaysPickReport }) {
  if (!report) {
    return (
      <div className="panel-lg mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="eyebrow mb-0">Today&apos;s pick</div>
          <span className="font-mono text-[10px] text-[var(--color-text-low)] uppercase tracking-wider">
            Waiting
          </span>
        </div>
        <p className="text-sm text-[var(--color-text-mid)] leading-relaxed">
          The daily pipeline runs at{" "}
          <span className="text-[var(--color-text-hi)]">06:00 UTC</span>{" "}
          (11:00 AM PKT). Today&apos;s report will appear here once the
          committee finishes.
        </p>
      </div>
    );
  }

  const json = (report.reportJson ?? {}) as Record<string, unknown>;
  const summary =
    (json.executive_summary as string | undefined) ??
    (json.startup_overview as string | undefined) ??
    "No summary available.";
  const stars = report.starRating ?? (json.star_rating as number | undefined);
  const checkSize = json.recommended_check_size as string | undefined;
  const stage = json.recommended_stage as string | undefined;

  const decisionClass =
    report.decision === "INVEST"
      ? "badge-invest"
      : report.decision === "PASS"
      ? "badge-pass"
      : "font-mono text-xs text-[var(--color-text-mid)]";

  const ageMs = Date.now() - report.createdAt.getTime();
  const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
  const ageLabel =
    ageHours < 1
      ? "just now"
      : ageHours === 1
      ? "1 hour ago"
      : `${ageHours} hours ago`;

  return (
    <div
      className="panel-lg mb-8 relative overflow-hidden"
      style={{ borderColor: "rgba(57, 255, 20, 0.25)" }}
    >
      {/* Soft glow accent */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 100% 0%, rgba(57,255,20,0.08), transparent 60%)",
        }}
        aria-hidden
      />

      <div className="relative">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="eyebrow mb-0">Today&apos;s pick</div>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-neon)] pulse-glow" />
            <span className="font-mono text-[10px] text-[var(--color-text-low)] uppercase tracking-wider">
              {ageLabel}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {report.decision && (
              <span className={decisionClass}>{report.decision}</span>
            )}
            {typeof stars === "number" && (
              <span className="text-xs text-[var(--color-amber)]">
                {"★".repeat(stars)}
                {"☆".repeat(5 - stars)}
              </span>
            )}
            {typeof report.weightedScore === "number" && (
              <span className="font-mono text-xs text-[var(--color-text-mid)]">
                score {report.weightedScore.toFixed(2)}/10
              </span>
            )}
          </div>
        </div>

        <h2 className="text-2xl md:text-3xl font-semibold mb-3">
          {report.company ?? "Unknown company"}
        </h2>

        <p className="text-sm text-[var(--color-text-mid)] leading-relaxed mb-6 max-w-3xl">
          {summary}
        </p>

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 text-xs font-mono text-[var(--color-text-low)]">
            {report.candidate?.source && (
              <span>from {report.candidate.source}</span>
            )}
            {checkSize && (
              <>
                <span>·</span>
                <span>check size {checkSize}</span>
              </>
            )}
            {stage && (
              <>
                <span>·</span>
                <span>{stage}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/reports/${report.id}`}
              className="btn-ghost text-sm"
            >
              Read full report →
            </Link>
            <a
              href={`/api/v1/reports/${report.id}/pdf`}
              className="btn-primary text-sm"
            >
              ↓ Download PDF
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}