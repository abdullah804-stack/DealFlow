import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Public sample — redirects to the newest discovery report.
 */
export default async function SampleRedirectPage() {
  const latest = await prisma.report.findFirst({
    where: { subjectType: "candidate" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!latest) notFound();

  // Render a link — real redirect is handled by the child [id] route
  return (
    <main className="relative z-10 min-h-screen flex items-center justify-center px-8">
      <div className="max-w-2xl text-center">
        <div className="eyebrow mb-4">Sample report</div>
        <h1 className="text-3xl font-semibold mb-6">
          See what DealFlow produces
        </h1>
        <p className="text-[var(--color-text-mid)] mb-8">
          Every day, DealFlow discovers startups, evaluates them through a
          five-specialist committee, and writes a full investment memo.
        </p>
        <Link
          href={`/sample/${latest.id}`}
          className="btn-primary inline-block"
        >
          View the latest report
        </Link>
      </div>
    </main>
  );
}