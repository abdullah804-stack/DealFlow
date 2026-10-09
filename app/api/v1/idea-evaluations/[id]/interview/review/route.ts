import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { z } from "zod";

const UpdateAnswerSchema = z.object({
  turnId: z.string().min(1),
  answerText: z.string().max(2000),
});

/**
 * GET — return all turns for the review page.
 * POST — update a specific turn's answer during review.
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

  return NextResponse.json({
    data: {
      status: evaluation.status,
      turns:
        evaluation.session?.turns.map((t) => ({
          id: t.id,
          turnIndex: t.turnIndex,
          specialist: t.specialist,
          questionKey: t.questionKey,
          questionText: t.questionText,
          answerText: t.answerText,
          skipped: t.skipped,
        })) ?? [],
    },
    requestId,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = `req_${crypto.randomUUID()}`;
  const userId = await requireUserId();
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = UpdateAnswerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid payload.",
          details: parsed.error.flatten().fieldErrors,
          requestId,
        },
      },
      { status: 400 }
    );
  }

  const evaluation = await prisma.ideaEvaluation.findFirst({
    where: { id, userId },
    include: { session: true },
  });

  if (!evaluation || !evaluation.session) {
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

  // Verify the turn belongs to this session
  const turn = await prisma.interviewTurn.findFirst({
    where: {
      id: parsed.data.turnId,
      sessionId: evaluation.session.id,
    },
  });

  if (!turn) {
    return NextResponse.json(
      {
        error: {
          code: "TURN_NOT_FOUND",
          message: "Turn not found in this session.",
          details: [],
          requestId,
        },
      },
      { status: 404 }
    );
  }

  await prisma.interviewTurn.update({
    where: { id: turn.id },
    data: {
      answerText: parsed.data.answerText,
      answeredAt: new Date(),
      skipped: false,
    },
  });

  return NextResponse.json({
    data: { updated: true },
    requestId,
  });
}