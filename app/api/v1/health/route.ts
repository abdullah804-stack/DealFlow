import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const requestId = `req_${crypto.randomUUID()}`;
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { data: { status: "ok", db: "connected" }, requestId },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "DB_UNREACHABLE",
          message: "Database unreachable",
          details: [],
          requestId,
        },
      },
      { status: 503 }
    );
  }
}