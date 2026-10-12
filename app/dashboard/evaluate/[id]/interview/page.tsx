import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { SPECIALIST_ORDER } from "@/lib/interview/specialists";

export const dynamic = "force-dynamic";

/**
 * Interview entry point — routes to the correct specialist page.
 *
 * Logic:
 * 1. If the evaluation is already past interviewing, redirect to /review.
 * 2. Otherwise, find the first specialist whose 5 questions aren't all done
 *    and redirect there.
 */
export default async function InterviewRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;

  const evaluation = await prisma.ideaEvaluation.findFirst({
    where: { id, userId },
    include: {
      session: {
        include: { turns: { orderBy: { turnIndex: "asc" } } },
      },
    },
  });

  if (!evaluation) {
    redirect("/dashboard/evaluate");
  }

  // Already finished interviewing → review
  if (evaluation.status === "review" || evaluation.status === "evaluating" || evaluation.status === "complete") {
    redirect(`/dashboard/evaluate/${id}/review`);
  }

  if (evaluation.status !== "interviewing") {
    redirect(`/dashboard/evaluate/${id}`);
  }

  const turns = evaluation.session?.turns ?? [];

  // Find the first specialist whose questions aren't all done
  for (const specialist of SPECIALIST_ORDER) {
    const forThis = turns.filter((t) => t.specialist === specialist);
    const answered = forThis.filter(
      (t) => t.answerText && t.answerText.trim().length > 0
    ).length;
    const skipped = forThis.filter((t) => t.skipped).length;

    // A specialist's questions are "done" when we've asked all 5 and
    // every one is either answered or skipped.
    if (forThis.length < 5 || answered + skipped < forThis.length) {
      redirect(`/dashboard/evaluate/${id}/interview/${specialist}`);
    }
  }

  // All done but status wasn't updated — send to review anyway
  redirect(`/dashboard/evaluate/${id}/review`);
}