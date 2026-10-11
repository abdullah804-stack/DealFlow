import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { canTransition } from "@/lib/interview/state-machine";
import { runCommitteeForEvaluation } from "@/lib/agents/committee";
import type { IdeaEvaluationStatus } from "@/lib/interview/schema";

/**
 * POST /api/v1/idea-evaluations/[id]/evaluation/start
 *
 * Transitions a review-ready or failed_partial evaluation into "evaluating"
 * and runs the full TS committee. Persists assessments, decision, and
 * report, then flips status to "complete".
 *
 * Synchronous call. Committee execution takes 2-5 minutes.
 * Vercel free tier has a 300s function limit. Committee was optimized in
 * Phase 8.1 to fit; if it ever exceeds, the client gets a 504 and can retry.
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

  const status = evaluation.status as IdeaEvaluationStatus;

  const startableStatuses: IdeaEvaluationStatus[] = [
    "review",
    "failed_partial",
  ];

  if (!startableStatuses.includes(status)) {
    return NextResponse.json(
      {
        error: {
          code: "WRONG_STATE",
          message: `Cannot start evaluation from status "${status}". Interview must be finished first, or the run must be in a retryable state.`,
          details: [],
          requestId,
        },
      },
      { status: 409 }
    );
  }

  if (!canTransition(status, "evaluating")) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_TRANSITION",
          message: `State machine rejected ${status}→evaluating.`,
          details: [],
          requestId,
        },
      },
      { status: 409 }
    );
  }

  // Flip status to evaluating before we start the long-running work,
  // so the progress page sees the transition immediately.
  if (evaluation.session) {
    await prisma.interviewSession.update({
      where: { id: evaluation.session.id },
      data: { status: "complete", currentQuestionKey: null },
    });
  }

  await prisma.ideaEvaluation.update({
    where: { id: evaluation.id },
    data: { status: "evaluating", failureReason: null },
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