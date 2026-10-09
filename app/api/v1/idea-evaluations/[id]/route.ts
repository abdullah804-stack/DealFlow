import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";

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
      session: {
        include: {
          turns: {
            orderBy: { turnIndex: "asc" },
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

  return NextResponse.json({
    data: {
      evaluation: {
        id: evaluation.id,
        title: evaluation.title,
        oneLiner: evaluation.oneLiner,
        problem: evaluation.problem,
        solution: evaluation.solution,
        targetMarket: evaluation.targetMarket,
        businessModel: evaluation.businessModel,
        teamBackground: evaluation.teamBackground,
        competitors: evaluation.competitors,
        fundingStage: evaluation.fundingStage,
        askAmount: evaluation.askAmount,
        status: evaluation.status,
        failureReason: evaluation.failureReason,
        createdAt: evaluation.createdAt.toISOString(),
        updatedAt: evaluation.updatedAt.toISOString(),
      },
      session: evaluation.session
        ? {
            id: evaluation.session.id,
            status: evaluation.session.status,
            currentQuestionKey: evaluation.session.currentQuestionKey,
            questionsAsked: evaluation.session.questionsAsked,
            questionsAnswered: evaluation.session.questionsAnswered,
            turns: evaluation.session.turns.map((t) => ({
              id: t.id,
              turnIndex: t.turnIndex,
              specialist: t.specialist,
              questionKey: t.questionKey,
              questionText: t.questionText,
              isClarification: t.isClarification,
              answerText: t.answerText,
              skipped: t.skipped,
              createdAt: t.createdAt.toISOString(),
              answeredAt: t.answeredAt?.toISOString() ?? null,
            })),
          }
        : null,
    },
    requestId,
  });
}