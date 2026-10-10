import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";

/**
 * GET /api/v1/idea-evaluations/[id]/evaluation/status
 *
 * Polled by the progress page. Returns current status and, when complete,
 * the decision and report reference.
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
      candidate: {
        select: {
          id: true,
          dossiers: {
            select: {
              decisions: {
                select: {
                  decision: true,
                  weightedScore: true,
                  reports: { select: { id: true }, take: 1 },
                },
                take: 1,
                orderBy: { createdAt: "desc" },
              },
            },
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
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

  const dossier = evaluation.candidate?.dossiers?.[0];
  const decision = dossier?.decisions?.[0];
  const reportId = decision?.reports?.[0]?.id ?? null;

  return NextResponse.json({
    data: {
      id: evaluation.id,
      status: evaluation.status,
      failureReason: evaluation.failureReason,
      progress: null,
      decision: decision?.decision ?? null,
      weightedScore: decision?.weightedScore ?? null,
      reportId,
    },
    requestId,
  });
}