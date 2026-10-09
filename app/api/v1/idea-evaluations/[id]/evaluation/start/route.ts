import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { canTransition } from "@/lib/interview/state-machine";

/**
 * POST /api/v1/idea-evaluations/[id]/evaluation/start
 *
 * Transitions a review-ready evaluation into "evaluating".
 *
 * As of Phase 5, this endpoint only marks the transition. The actual
 * committee run happens in Phase 6 once the TypeScript committee port
 * is complete. The progress page polls /evaluation/status, which will
 * return `pending` until Phase 6 lands.
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
      session: {
        include: { turns: { orderBy: { turnIndex: "asc" } } },
      },
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

  // Verify the interview is complete (all 20 required questions answered)
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

  // Ensure the session is marked complete
  if (evaluation.session) {
    await prisma.interviewSession.update({
      where: { id: evaluation.session.id },
      data: { status: "complete", currentQuestionKey: null },
    });
  }

  // Mark the evaluation as evaluating
  await prisma.ideaEvaluation.update({
    where: { id: evaluation.id },
    data: { status: "evaluating" },
  });

  return NextResponse.json({
    data: {
      id: evaluation.id,
      status: "evaluating",
      // Phase 6 will wire in the real committee here
      engine: "pending",
      message:
        "Committee evaluation queued. The TypeScript committee port lands in Phase 6.",
    },
    requestId,
  });
}