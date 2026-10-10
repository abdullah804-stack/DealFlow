import { z } from "zod";

/**
 * Versioned report JSON schema.
 * Every report stored in the `reports.reportJson` column must satisfy
 * this schema. Bump the schema version if the shape changes.
 *
 * This schema is the contract between:
 * - Report generators (Python discovery + TS committee)
 * - PDF renderers (discovery.tsx, founder.tsx)
 * - Web viewers (dashboard/reports/[id], dashboard/evaluate/[id]/report)
 */

export const ReportSchemaVersion = "1.0" as const;

export const EvidenceItemSchema = z.object({
  id: z.string(),
  claim: z.string(),
  sourceUrl: z.string().optional(),
  supportLevel: z.string().optional(),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const DisagreementSchema = z.object({
  topic: z.string(),
  positions: z.array(
    z.object({
      agentType: z.string(),
      position: z.string(),
    })
  ),
});
export type Disagreement = z.infer<typeof DisagreementSchema>;

export const ReportJsonSchema = z.object({
  schemaVersion: z.string().default(ReportSchemaVersion),
  subjectType: z.enum(["candidate", "idea_evaluation", "backtest"]),
  subjectId: z.string().optional(),
  generatedAt: z.string(),

  // Core fields
  company: z.string(),
  decision: z.string(),
  weighted_score: z.number().optional(),

  // Optional numeric fields
  star_rating: z.number().int().min(1).max(5).optional(),
  probability_of_success_pct: z.number().int().min(0).max(100).optional(),
  recommended_check_size: z.string().optional(),
  recommended_stage: z.string().optional(),

  // Section fields — all optional; both templates render what's present
  executive_summary: z.string().optional(),
  startup_overview: z.string().optional(),
  competitive_landscape: z.string().optional(),
  technology_analysis: z.string().optional(),
  market_analysis: z.string().optional(),
  financial_analysis: z.string().optional(),
  legal_analysis: z.string().optional(),
  founder_evaluation: z.string().optional(),
  debate_summary: z.string().optional(),
  recommendation: z.string().optional(),

  // Headline strings
  biggest_risk: z.string().optional(),
  biggest_advantage: z.string().optional(),

  // Committee metadata (present on both report types when available)
  committee: z
    .object({
      weightedScore: z.number(),
      decision: z.string(),
      disagreements: z.array(DisagreementSchema).optional(),
      rubricVersion: z.string(),
    })
    .optional(),

  // Provenance
  evidence: z.array(EvidenceItemSchema).optional(),
  unknowns: z.array(z.string()).optional(),
  source_info: z
    .object({
      subjectType: z.string().optional(),
      subjectId: z.string().optional(),
      platform: z.string().optional(),
      platform_display: z.string().optional(),
      username: z.string().optional(),
      url: z.string().optional(),
    })
    .optional(),

  disclaimer: z.string().optional(),
});

export type ReportJson = z.infer<typeof ReportJsonSchema>;

/**
 * Section keys in the order they render. Both templates use this.
 */
export const REPORT_SECTION_ORDER = [
  "executive_summary",
  "startup_overview",
  "competitive_landscape",
  "technology_analysis",
  "market_analysis",
  "financial_analysis",
  "legal_analysis",
  "founder_evaluation",
  "debate_summary",
  "recommendation",
] as const;

export type ReportSectionKey = (typeof REPORT_SECTION_ORDER)[number];