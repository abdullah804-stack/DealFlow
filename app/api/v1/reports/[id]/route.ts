import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeReport } from "@/lib/api/serializers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = `req_${crypto.randomUUID()}`;
  const { id } = await params;

  const report = await prisma.report.findUnique({ where: { id } });

  if (!report) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Report not found.",
          details: [],
          requestId,
        },
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: { report: serializeReport(report) },
    requestId,
  });
}