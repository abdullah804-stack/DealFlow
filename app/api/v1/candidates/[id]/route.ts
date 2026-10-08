import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  serializeCandidate,
  serializeDossier,
  serializeDecision,
  serializeReport,
} from "@/lib/api/serializers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = `req_${crypto.randomUUID()}`;
  const { id } = await params;

  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      dossiers: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          decisions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              reports: {
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
        },
      },
      assessments: {
        orderBy: [{ round: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!candidate) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Candidate not found.",
          details: [],
          requestId,
        },
      },
      { status: 404 }
    );
  }

  const dossier = candidate.dossiers[0] ?? null;
  const decision = dossier?.decisions[0] ?? null;
  const report = decision?.reports[0] ?? null;

  return NextResponse.json({
    data: {
      candidate: serializeCandidate(candidate),
      dossier: dossier ? serializeDossier(dossier) : null,
      decision: decision ? serializeDecision(decision) : null,
      report: report ? serializeReport(report) : null,
      assessments: candidate.assessments.map((a) => ({
        id: a.id,
        agentType: a.agentType,
        round: a.round,
        score: a.score,
        confidence: a.confidence,
        summary: a.summary,
        strengths: a.strengths,
        weaknesses: a.weaknesses,
        risks: a.risks,
        unknowns: a.unknowns,
        createdAt: a.createdAt.toISOString(),
      })),
    },
    requestId,
  });
}