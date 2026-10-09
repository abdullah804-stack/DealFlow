import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";

/**
 * GET /api/v1/idea-evaluations/[id]/evaluation/status
 *
 * Polled by the progress page. Once Phase 6 lands, this route returns
 * live progress from the committee run (assessments written, decision
 * made, report generated). Until then it returns `pending`.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = `req_${crypto.randomUUID()}`;
  const userId = await requireUserId();
  const { id } = await params;

  const evaluation = await prisma.ideaEvaluation.findFirst({
    where: { id, userId },
    include: {
      session: { select: { id: true } },
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

  // Phase 5: no committee run has happened yet. Return whatever the
  // evaluation's state says, and let the client render accordingly.
  return NextResponse.json({
    data: {
      id: evaluation.id,
      status: evaluation.status,
      failureReason: evaluation.failureReason,
      // These will be populated in Phase 6 when the committee runs.
      progress: null,
      decision: null,
      reportId: null,
    },
    requestId,
  });
}