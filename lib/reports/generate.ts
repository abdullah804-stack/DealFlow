import { createHash } from "crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { ReportJsonSchema, type ReportJson } from "./schema";
import { DiscoveryReportPdf } from "./templates/discovery";
import { FounderReportPdf } from "./templates/founder";

/**
 * Renders a stored report JSON to PDF and uploads it to Vercel Blob.
 * Idempotent: if the row already has a pdfBlobUrl AND the content hash
 * matches, this returns the existing URL without re-rendering.
 *
 * Never regenerates from a fresh AI call. The input is always
 * reports.reportJson as stored.
 */

export type GeneratePdfResult = {
  reportId: string;
  pdfUrl: string;
  contentHash: string;
  cached: boolean;
};

export async function generateReportPdf(
  reportId: string
): Promise<GeneratePdfResult> {
  const row = await prisma.report.findUnique({ where: { id: reportId } });
  if (!row) throw new Error(`Report ${reportId} not found`);

  const parsed = ReportJsonSchema.safeParse(row.reportJson);
  if (!parsed.success) {
    throw new Error(
      `Report JSON does not match schema: ${parsed.error.message.slice(0, 200)}`
    );
  }
  const report: ReportJson = parsed.data;

  // Content hash — deterministic given the JSON
  const hash = createHash("sha256")
    .update(JSON.stringify(report))
    .digest("hex")
    .slice(0, 32);

  // Cache check: same content hash + existing blob → return existing
  if (row.pdfBlobUrl && row.contentHash === hash) {
    return {
      reportId,
      pdfUrl: row.pdfBlobUrl,
      contentHash: hash,
      cached: true,
    };
  }

  // Render to PDF buffer
  const template =
    report.subjectType === "idea_evaluation"
      ? FounderReportPdf({ report })
      : DiscoveryReportPdf({ report });

  const buffer = await renderToBuffer(template);

  // Upload to Vercel Blob (private)
  const blob = await put(
    `reports/${reportId}-${hash}.pdf`,
    buffer,
    {
      access: "private",
      contentType: "application/pdf",
      addRandomSuffix: false,
      allowOverwrite: true,
    }
  );

  // Persist URL + hash
  await prisma.report.update({
    where: { id: reportId },
    data: {
      pdfBlobUrl: blob.url,
      contentHash: hash,
    },
  });

  return {
    reportId,
    pdfUrl: blob.url,
    contentHash: hash,
    cached: false,
  };
}