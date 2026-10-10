import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/authz";
import { generateReportPdf } from "@/lib/reports/generate";
import { get } from "@vercel/blob";

/**
 * GET /api/v1/reports/[id]/pdf
 *
 * Streams the report PDF. Generates it on first request if needed.
 *
 * Ownership check:
 * - For discovery reports (subjectType=candidate): any authenticated user
 *   can view (the daily pipeline is a public demo feed).
 * - For idea-evaluation reports (subjectType=idea_evaluation): only the
 *   owner of the originating evaluation.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = `req_${crypto.randomUUID()}`;
  const userId = await requireUserId();
  const { id } = await params;

  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      candidate: {
        select: {
          id: true,
          ideaEvaluation: { select: { userId: true } },
        },
      },
    },
  });

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

  // Ownership check for idea evaluations
  if (report.subjectType === "idea_evaluation") {
    const owner = report.candidate?.ideaEvaluation?.userId;
    if (owner !== userId) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have access to this report.",
            details: [],
            requestId,
          },
        },
        { status: 403 }
      );
    }
  }

  // Generate on demand if missing or stale
  let pdfUrl = report.pdfBlobUrl;
  try {
    if (!pdfUrl) {
      const result = await generateReportPdf(report.id);
      pdfUrl = result.pdfUrl;
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: {
          code: "PDF_GENERATION_FAILED",
          message:
            e instanceof Error ? e.message : "Could not generate PDF.",
          details: [],
          requestId,
        },
      },
      { status: 500 }
    );
  }

  if (!pdfUrl) {
    return NextResponse.json(
      {
        error: {
          code: "PDF_UNAVAILABLE",
          message: "PDF is not available.",
          details: [],
          requestId,
        },
      },
      { status: 500 }
    );
  }

  // Fetch the blob and stream it. For private blobs we must proxy through
  // the server, not redirect.
  try {
    const blobResult = await get(pdfUrl, { access: "private" });
    if (!blobResult || blobResult.statusCode !== 200 || !blobResult.stream) {
      throw new Error("Blob fetch failed");
    }

    const filename = `${(report.company ?? "report").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${report.id.slice(0, 8)}.pdf`;

    return new Response(blobResult.stream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: {
          code: "PDF_STREAM_FAILED",
          message: e instanceof Error ? e.message : "Could not stream PDF.",
          details: [],
          requestId,
        },
      },
      { status: 500 }
    );
  }
}