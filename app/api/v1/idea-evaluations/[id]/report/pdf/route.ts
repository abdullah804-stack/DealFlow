import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";

/**
 * GET /api/v1/idea-evaluations/[id]/report/pdf
 *
 * Resolves the evaluation's report and redirects to the canonical
 * report PDF endpoint. Exists because the founder report page only knows
 * the evaluation ID, not the internal report ID.
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
    select: {
      id: true,
      candidateId: true,
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

  if (!evaluation.candidateId) {
    return NextResponse.json(
      {
        error: {
          code: "NO_REPORT",
          message: "This evaluation has no report yet.",
          details: [],
          requestId,
        },
      },
      { status: 409 }
    );
  }

  const report = await prisma.report.findFirst({
    where: {
      candidateId: evaluation.candidateId,
      subjectType: "idea_evaluation",
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  if (!report) {
    return NextResponse.json(
      {
        error: {
          code: "NO_REPORT",
          message: "No report found for this evaluation.",
          details: [],
          requestId,
        },
      },
      { status: 404 }
    );
  }

  // Redirect to the canonical PDF endpoint
  const target = new URL(
    `/api/v1/reports/${report.id}/pdf`,
    new URL(_req.url).origin
  );
  return NextResponse.redirect(target);
}