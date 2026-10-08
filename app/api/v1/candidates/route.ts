import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serializeCandidate } from "@/lib/api/serializers";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  source: z.string().optional(),
  minConfidence: z.coerce.number().min(0).max(10).optional(),
});

export async function GET(req: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
    source: url.searchParams.get("source") ?? undefined,
    minConfidence: url.searchParams.get("minConfidence") ?? undefined,
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

  const { limit, offset, source, minConfidence } = parsed.data;

  const where = {
    ...(source ? { source } : {}),
    ...(minConfidence !== undefined
      ? { discoveryConfidence: { gte: minConfidence } }
      : {}),
  };

  const [candidates, total] = await Promise.all([
    prisma.candidate.findMany({
      where,
      orderBy: { firstSeen: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.candidate.count({ where }),
  ]);

  return NextResponse.json({
    data: {
      candidates: candidates.map(serializeCandidate),
      pagination: { total, limit, offset },
    },
    requestId,
  });
}