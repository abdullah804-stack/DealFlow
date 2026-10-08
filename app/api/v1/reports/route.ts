import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serializeReport } from "@/lib/api/serializers";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  subjectType: z.enum(["candidate", "idea_evaluation", "backtest"]).optional(),
});

export async function GET(req: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
    subjectType: url.searchParams.get("subjectType") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters.",
          details: parsed.error.flatten().fieldErrors,
          requestId,
        },
      },
      { status: 400 }
    );
  }

  const { limit, offset, subjectType } = parsed.data;
  const where = subjectType ? { subjectType } : {};

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.report.count({ where }),
  ]);

  return NextResponse.json({
    data: {
      reports: reports.map(serializeReport),
      pagination: { total, limit, offset },
    },
    requestId,
  });
}