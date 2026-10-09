import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { IntakeSchema } from "@/lib/interview/schema";

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

  return NextResponse.json(
    {
      data: {
        id: evaluation.id,
        status: evaluation.status,
        sessionId: evaluation.session?.id,
      },
      requestId,
    },
    { status: 201 }
  );
}