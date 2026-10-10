import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { canTransition } from "@/lib/interview/state-machine";
import { runCommitteeForEvaluation } from "@/lib/agents/committee";

/**
 * POST /api/v1/idea-evaluations/[id]/evaluation/start
 *
 * Transitions a review-ready evaluation into "evaluating" and runs the
 * full TS committee. Persists assessments, decision, and report, then
 * flips status to "complete".
 *
 * This is a synchronous call. Real execution takes 3-6 minutes due to
 * sequential LLM calls. In production this should move to a background
 * worker, but for v1 a synchronous call is acceptable because the request
 * comes from an explicit user action (clicking "Run committee") and the
 * progress page polls after the request fires.
 *
 * Note: Vercel's 300s function limit applies. If the committee run
 * exceeds it, the client will see a 504. In that case, retry.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = `req_${crypto.randomUUID()}`;
  const userId = await requireUserId();
  const { id } = await params;

  const evaluation = await prisma.ideaEvaluation.findFirst({
    where: { id, userId },
    include: {
      session: { select: { id: true, status: true } },
    },
  });

  if (!evaluation) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Evaluation not found.",
          details: [],
          requestId,
        },
      },
      { status: 404 }
    );
  }

  if (evaluation.status !== "review") {
    return NextResponse.json(
      {
        error: {
          code: "WRONG_STATE",
          message: `Cannot start evaluation from status "${evaluation.status}". Interview must be finished first.`,
          details: [],
          requestId,
        },
      },
      { status: 409 }
    );
  }

  if (!canTransition("review", "evaluating")) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_TRANSITION",
          message: "State machine rejected review→evaluating.",
          details: [],
          requestId,
        },
      },
      { status: 409 }
    );
  }

  // Flip statuses to evaluating before we start the long-running work,
  // so the progress page sees the transition immediately.
  if (evaluation.session) {
    await prisma.interviewSession.update({
      where: { id: evaluation.session.id },
      data: { status: "complete", currentQuestionKey: null },
    });
  }

  await prisma.ideaEvaluation.update({
    where: { id: evaluation.id },
    data: { status: "evaluating" },
  });

  try {
    const result = await runCommitteeForEvaluation(evaluation.id);

    return NextResponse.json({
      data: {
        id: evaluation.id,
        status: "complete",
        decision: result.decision,
        weightedScore: result.weightedScore,
        reportId: result.reportId,
      },
      requestId,
    });
  } catch (e) {
    // Mark as failed_partial so the user can retry
    await prisma.ideaEvaluation.update({
      where: { id: evaluation.id },
      data: {
        status: "failed_partial",
        failureReason:
          e instanceof Error ? e.message : "Unknown committee failure",
      },
    });

    return NextResponse.json(
      {
        error: {
          code: "COMMITTEE_FAILED",
          message:
            e instanceof Error
              ? e.message
              : "Committee run failed. Your answers are saved; you can retry.",
          details: [],
          requestId,
        },
      },
      { status: 500 }
    );
  }
}