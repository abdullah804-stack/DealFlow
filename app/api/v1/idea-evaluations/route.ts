import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { IntakeSchema } from "@/lib/interview/schema";
import { generateNextQuestion } from "@/lib/interview/turn-generator";

export async function GET() {
  const requestId = `req_${crypto.randomUUID()}`;
  const userId = await requireUserId();

  const evaluations = await prisma.ideaEvaluation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      oneLiner: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      failureReason: true,
    },
  });

  return NextResponse.json({
    data: { evaluations },
    requestId,
  });
}

export async function POST(req: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  const userId = await requireUserId();

  const body = await req.json().catch(() => null);
  const parsed = IntakeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid intake data.",
          details: parsed.error.flatten().fieldErrors,
          requestId,
        },
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const evaluation = await prisma.ideaEvaluation.create({
    data: {
      userId,
      title: data.title,
      oneLiner: data.oneLiner,
      problem: data.problem,
      solution: data.solution,
      targetMarket: data.targetMarket ?? null,
      businessModel: data.businessModel ?? null,
      teamBackground: data.teamBackground ?? null,
      competitors: data.competitors ?? null,
      fundingStage: data.fundingStage ?? null,
      askAmount: data.askAmount ?? null,
      status: "interviewing",
      session: {
        create: {
          status: "interviewing",
          questionsAsked: 0,
          questionsAnswered: 0,
        },
      },
    },
    include: {
      session: true,
    },
  });

  if (!evaluation.session) {
    return NextResponse.json(
      {
        error: {
          code: "SESSION_CREATE_FAILED",
          message: "Could not create interview session.",
          details: [],
          requestId,
        },
      },
      { status: 500 }
    );
  }

  // Generate the first question immediately so the user lands on a page
  // that's ready to answer.
  let firstTurnCreated = false;
  try {
    const next = await generateNextQuestion(
      {
        title: data.title,
        oneLiner: data.oneLiner,
        problem: data.problem,
        solution: data.solution,
        targetMarket: data.targetMarket ?? undefined,
        businessModel: data.businessModel ?? undefined,
      },
      []
    );

    if (next) {
      await prisma.interviewTurn.create({
        data: {
          sessionId: evaluation.session.id,
          turnIndex: next.turnIndex,
          specialist: next.specialist,
          questionKey: next.questionKey,
          questionText: next.questionText,
          isClarification: next.isClarification,
        },
      });
      await prisma.interviewSession.update({
        where: { id: evaluation.session.id },
        data: {
          currentQuestionKey: next.questionKey,
          questionsAsked: 1,
        },
      });
      firstTurnCreated = true;
    }
  } catch (e) {
    console.error("Failed to generate first question:", e);
  }

  return NextResponse.json(
    {
      data: {
        id: evaluation.id,
        status: evaluation.status,
        sessionId: evaluation.session.id,
        firstTurnCreated,
      },
      requestId,
    },
    { status: 201 }
  );
}