import Link from "next/link";
import { getEmptyFunnel } from "@/lib/api/fallback";

export default async function DashboardPage() {
  const funnel = getEmptyFunnel(7);

  return (
    <div>
      <div className="mb-8">
        <div className="eyebrow">Overview</div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-[var(--color-text-mid)] text-sm mt-2">
          The daily cycle runs at 06:00 UTC. Discovery results appear here.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <div className="stat-index">01</div>
          <div className="stat-number text-[var(--color-blue)]">{funnel.discovered}</div>
          <div className="stat-label">Discovered</div>
        </div>
        <div className="stat-card">
          <div className="stat-index">02</div>
          <div className="stat-number text-[var(--color-amber)]">{funnel.validated}</div>
          <div className="stat-label">Validated</div>
        </div>
        <div className="stat-card">
          <div className="stat-index">03</div>
          <div className="stat-number text-[var(--color-coral)]">{funnel.escalated}</div>
          <div className="stat-label">Escalated</div>
        </div>
        <div className="stat-card">
          <div className="stat-index">04</div>
          <div className="stat-number text-[var(--color-teal)]">{funnel.invested}</div>
          <div className="stat-label">Invested</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Link href="/dashboard/discover" className="panel hover:border-[var(--color-teal)] transition-colors">
          <div className="text-[var(--color-teal)] text-lg mb-3">▽</div>
          <h3 className="font-semibold mb-1">Discover</h3>
          <p className="text-xs text-[var(--color-text-mid)]">
            Browse all candidates from the daily pipeline
          </p>
        </Link>
        <Link href="/dashboard/reports" className="panel hover:border-[var(--color-teal)] transition-colors">
          <div className="text-[var(--color-teal)] text-lg mb-3">▤</div>
          <h3 className="font-semibold mb-1">Reports</h3>
          <p className="text-xs text-[var(--color-text-mid)]">
            VC-memo writeups for committee-reviewed candidates
          </p>
        </Link>
        <Link href="/dashboard/evaluate" className="panel hover:border-[var(--color-teal)] transition-colors">
          <div className="text-[var(--color-teal)] text-lg mb-3">◇</div>
          <h3 className="font-semibold mb-1">Evaluate</h3>
          <p className="text-xs text-[var(--color-text-mid)]">
            Submit your own idea to the committee
          </p>
        </Link>
        <Link href="/dashboard/settings" className="panel hover:border-[var(--color-teal)] transition-colors">
          <div className="text-[var(--color-teal)] text-lg mb-3">⚙</div>
          <h3 className="font-semibold mb-1">Settings</h3>
          <p className="text-xs text-[var(--color-text-mid)]">
            Profile, privacy, and usage
          </p>
        </Link>
      </div>
    </div>
  );
}