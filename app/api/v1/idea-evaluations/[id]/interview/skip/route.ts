import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { SkipSchema } from "@/lib/interview/schema";
import { generateNextQuestion } from "@/lib/interview/turn-generator";
import { evaluateProgress } from "@/lib/interview/state-machine";
import { QUESTIONS, QUESTIONS_BY_KEY } from "@/lib/interview/questions";

const REQUIRED_KEYS = new Set(
  QUESTIONS.filter((q) => q.required).map((q) => q.key)
);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = `req_${crypto.randomUUID()}`;
  const userId = await requireUserId();
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = SkipSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid skip payload.",
          details: parsed.error.flatten().fieldErrors,
          requestId,
        },
      },
      { status: 400 }
    );
  }

  const { turnIndex } = parsed.data;

  const evaluation = await prisma.ideaEvaluation.findFirst({
    where: { id, userId },
    include: {
      session: {
        include: { turns: { orderBy: { turnIndex: "asc" } } },
      },
    },
  });

  if (!evaluation || !evaluation.session) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Evaluation or session not found.",
          details: [],
          requestId,
        },
      },
      { status: 404 }
    );
  }

  if (evaluation.status !== "interviewing") {
    return NextResponse.json(
      {
        error: {
          code: "WRONG_STATE",
          message: `Cannot skip while status is ${evaluation.status}.`,
          details: [],
          requestId,
        },
      },
      { status: 409 }
    );
  }

  const session = evaluation.session;
  const turn = session.turns.find((t) => t.turnIndex === turnIndex);

  if (!turn) {
    return NextResponse.json(
      {
        error: {
          code: "TURN_NOT_FOUND",
          message: `No turn with index ${turnIndex}.`,
          details: [],
          requestId,
        },
      },
      { status: 404 }
    );
  }

  if (turn.answerText || turn.skipped) {
    return NextResponse.json(
      {
        error: {
          code: "ALREADY_ANSWERED",
          message: "This turn has already been answered or skipped.",
          details: [],
          requestId,
        },
      },
      { status: 409 }
    );
  }

  // Hard rule: required questions cannot be skipped
  const question = QUESTIONS_BY_KEY[turn.questionKey];
  if (!question || question.required) {
    return NextResponse.json(
      {
        error: {
          code: "REQUIRED_QUESTION",
          message: "This question is required and cannot be skipped.",
          details: [],
          requestId,
        },
      },
      { status: 409 }
    );
  }

  // Mark as skipped
  await prisma.interviewTurn.update({
    where: { id: turn.id },
    data: { skipped: true },
  });

  const updatedTurns = await prisma.interviewTurn.findMany({
    where: { sessionId: session.id },
    orderBy: { turnIndex: "asc" },
  });

  const progress = evaluateProgress(
    updatedTurns.map((t) => ({
      questionKey: t.questionKey,
      answerText: t.answerText,
      skipped: t.skipped,
    })),
    REQUIRED_KEYS
  );

  // If required questions are all answered, transition to review
  if (progress.isComplete) {
    await prisma.interviewSession.update({
      where: { id: session.id },
      data: { status: "review", currentQuestionKey: null },
    });
    await prisma.ideaEvaluation.update({
      where: { id: evaluation.id },
      data: { status: "review" },
    });
    return NextResponse.json({
      data: { skipped: true, complete: true, progress },
      requestId,
    });
  }

  // Generate the next question
  const intake = {
    title: evaluation.title,
    oneLiner: evaluation.oneLiner,
    problem: evaluation.problem,
    solution: evaluation.solution,
    targetMarket: evaluation.targetMarket ?? undefined,
    businessModel: evaluation.businessModel ?? undefined,
  };

  const next = await generateNextQuestion(
    intake,
    updatedTurns.map((t) => ({
      questionKey: t.questionKey,
      specialist: t.specialist,
      questionText: t.questionText,
      answerText: t.answerText,
      skipped: t.skipped,
    }))
  );

  if (!next) {
    await prisma.ideaEvaluation.update({
      where: { id: evaluation.id },
      data: { status: "review" },
    });
    return NextResponse.json({
      data: { skipped: true, complete: true, progress },
      requestId,
    });
  }

  const newTurn = await prisma.interviewTurn.create({
    data: {
      sessionId: session.id,
      turnIndex: next.turnIndex,
      specialist: next.specialist,
      questionKey: next.questionKey,
      questionText: next.questionText,
      isClarification: next.isClarification,
    },
  });

  await prisma.interviewSession.update({
    where: { id: session.id },
    data: {
      currentQuestionKey: next.questionKey,
      questionsAsked: { increment: 1 },
    },
  });

  return NextResponse.json({
    data: {
      skipped: true,
      complete: false,
      nextQuestion: {
        id: newTurn.id,
        turnIndex: newTurn.turnIndex,
        specialist: newTurn.specialist,
        questionKey: newTurn.questionKey,
        questionText: newTurn.questionText,
        isLastRequired: next.isLastRequired,
      },
      progress,
    },
    requestId,
  });
}