import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { AnswerSchema } from "@/lib/interview/schema";
import { generateNextQuestion } from "@/lib/interview/turn-generator";
import {
  evaluateProgress,
  validateAnswerLength,
  HARD_CAPS,
} from "@/lib/interview/state-machine";
import { QUESTIONS } from "@/lib/interview/questions";

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
  const parsed = AnswerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid answer payload.",
          details: parsed.error.flatten().fieldErrors,
          requestId,
        },
      },
      { status: 400 }
    );
  }

  const { turnIndex, answerText } = parsed.data;

  try {
    validateAnswerLength(answerText);
  } catch (e) {
    return NextResponse.json(
      {
        error: {
          code: "ANSWER_TOO_LONG",
          message: e instanceof Error ? e.message : "Answer too long",
          details: [],
          requestId,
        },
      },
      { status: 400 }
    );
  }

  // Load evaluation + session + turns, verify ownership
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
          message: `Cannot answer while status is ${evaluation.status}.`,
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

  // Persist the answer
  await prisma.interviewTurn.update({
    where: { id: turn.id },
    data: {
      answerText,
      answeredAt: new Date(),
    },
  });

  // Reload turns
  const updatedTurns = await prisma.interviewTurn.findMany({
    where: { sessionId: session.id },
    orderBy: { turnIndex: "asc" },
  });

  // Compute progress
  const progress = evaluateProgress(
    updatedTurns.map((t) => ({
      questionKey: t.questionKey,
      answerText: t.answerText,
      skipped: t.skipped,
    })),
    REQUIRED_KEYS
  );

  // Update session counters
  await prisma.interviewSession.update({
    where: { id: session.id },
    data: {
      questionsAnswered: updatedTurns.filter(
        (t) => t.answerText && t.answerText.trim().length > 0
      ).length,
    },
  });

  // If interview complete, transition to review
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
      data: {
        savedAnswer: true,
        complete: true,
        progress,
      },
      requestId,
    });
  }

  // Generate next question
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
    // No more questions — should have hit isComplete above, but guard anyway
    await prisma.ideaEvaluation.update({
      where: { id: evaluation.id },
      data: { status: "review" },
    });
    return NextResponse.json({
      data: { savedAnswer: true, complete: true, progress },
      requestId,
    });
  }

  // Persist the new turn (unanswered)
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
      savedAnswer: true,
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