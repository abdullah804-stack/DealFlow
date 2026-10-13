import { requireUserId } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await requireUserId();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      createdAt: true,
      _count: {
        select: {
          ideaEvaluations: true,
        },
      },
    },
  });

  if (!user) {
    return (
      <div className="empty-state">
        <h3>Session invalid</h3>
        <p className="text-sm text-[var(--color-text-mid)] mt-2">
          Please sign in again.
        </p>
        <Link href="/login" className="btn-primary inline-block mt-4">
          Sign in
        </Link>
      </div>
    );
  }

  const evaluationCount = user._count.ideaEvaluations;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 md:mb-8">
        <div className="eyebrow">Account</div>
        <h1 className="text-2xl md:text-3xl font-semibold">Settings</h1>
        <p className="text-[var(--color-text-mid)] text-sm mt-2">
          Your profile, privacy, and usage.
        </p>
      </div>

      <section className="panel-lg mb-6">
        <h2 className="text-base md:text-lg font-semibold mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <div className="field-label">Name</div>
            <div className="text-sm text-[var(--color-text-hi)]">
              {user.name ?? (
                <span className="text-[var(--color-text-low)]">Not set</span>
              )}
            </div>
          </div>
          <div>
            <div className="field-label">Email</div>
            <div className="text-sm text-[var(--color-text-hi)] font-mono break-all">
              {user.email}
            </div>
          </div>
          <div>
            <div className="field-label">Member since</div>
            <div className="text-sm text-[var(--color-text-mid)]">
              {user.createdAt.toISOString().slice(0, 10)}
            </div>
          </div>
        </div>
      </section>

      <section className="panel-lg mb-6">
        <h2 className="text-base md:text-lg font-semibold mb-4">Usage</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="stat-card">
            <div className="stat-index">Idea evaluations</div>
            <div className="stat-number text-[var(--color-neon)]">
              {evaluationCount}
            </div>
            <div className="stat-label">
              {evaluationCount === 1 ? "submission" : "submissions"}
            </div>
          </div>
        </div>
      </section>

      <section className="panel-lg mb-6">
        <h2 className="text-base md:text-lg font-semibold mb-4">
          Privacy & Data
        </h2>
        <p className="text-sm text-[var(--color-text-mid)] leading-relaxed mb-4">
          Your account data, submissions, and interview answers are stored on
          our infrastructure and scoped to your account only. No other user
          can read them, and they are never used to train external models.
        </p>
        <p className="text-sm text-[var(--color-text-mid)] leading-relaxed mb-4">
          To request a copy of your data or full account deletion, contact
          support. We respond to all data requests within 30 days.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <a
            href="mailto:Muhammadabd778899@gmail.com?subject=Data%20request"
            className="btn-ghost text-sm text-center"
          >
            Request data export
          </a>
          <a
            href="mailto:Muhammadabd778899@gmail.com?subject=Account%20deletion"
            className="btn-ghost text-sm text-center"
          >
            Request account deletion
          </a>
        </div>
      </section>

      <section className="panel-lg">
        <h2 className="text-base md:text-lg font-semibold mb-4">Session</h2>
        <p className="text-sm text-[var(--color-text-mid)] mb-4">
          Sign out of this session. You&apos;ll need to sign in again to
          access your dashboard.
        </p>
        <form
          action="/api/auth/signout"
          method="post"
          className="inline-block"
        >
          <button type="submit" className="btn-ghost">
            Sign out
          </button>
        </form>
      </section>
    </div>
  );
}