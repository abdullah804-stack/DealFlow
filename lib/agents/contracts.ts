import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════
// SPECIALIST AGENTS
// ═══════════════════════════════════════════════════════════════════

export const AgentTypeSchema = z.enum([
  "technical",
  "finance",
  "marketing",
  "legal",
  "founder",
]);
export type AgentType = z.infer<typeof AgentTypeSchema>;

export const ConfidenceSchema = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

// The main specialist assessment contract (new plan §5a)
export const AgentAssessmentSchema = z.object({
  agentType: AgentTypeSchema,
  score: z.number().min(0).max(10),
  summary: z.string().min(20).max(800),
  strengths: z.array(z.string()).max(6),
  weaknesses: z.array(z.string()).max(6),
  risks: z.array(z.string()).max(6),
  assumptions: z.array(z.string()).max(10),
  evidenceIds: z.array(z.string()),
  unknowns: z.array(z.string()).max(10),
  recommendedActions: z.array(z.string()).max(5),
  confidence: ConfidenceSchema,
});
export type AgentAssessment = z.infer<typeof AgentAssessmentSchema>;

// ═══════════════════════════════════════════════════════════════════
// COMMITTEE INPUT
// ═══════════════════════════════════════════════════════════════════

export const EvaluationInputSchema = z.object({
  subjectType: z.enum(["candidate", "idea_evaluation"]),
  subjectId: z.string().min(1),
  dossier: z.object({
    company: z.string(),
    industry: z.string(),
    summary: z.string(),
    technology: z.string().optional(),
    competitors: z.array(z.string()).optional(),
    fundingStatus: z.string().optional(),
    pricingModel: z.string().optional(),
    targetMarket: z.string().optional(),
    businessModel: z.string().optional(),
    teamBackground: z.string().optional(),
  }),
  evidence: z
    .array(
      z.object({
        id: z.string(),
        claim: z.string(),
        sourceUrl: z.string().optional(),
        supportLevel: z.string().optional(),
      })
    )
    .default([]),
});
export type EvaluationInput = z.infer<typeof EvaluationInputSchema>;

// ═══════════════════════════════════════════════════════════════════
// MODERATOR
// ═══════════════════════════════════════════════════════════════════

export const DisagreementSchema = z.object({
  topic: z.string(),
  positions: z.array(
    z.object({
      agentType: AgentTypeSchema,
      position: z.string(),
    })
  ),
});
export type Disagreement = z.infer<typeof DisagreementSchema>;

export const ModeratorOutputSchema = z.object({
  disagreements: z.array(DisagreementSchema).max(5),
  summary: z.string().min(20).max(1500),
});
export type ModeratorOutput = z.infer<typeof ModeratorOutputSchema>;

// ═══════════════════════════════════════════════════════════════════
// VOTING
// ═══════════════════════════════════════════════════════════════════

export const DecisionSchema = z.enum([
  "INVEST",
  "PASS",
  "INSUFFICIENT_EVIDENCE",
]);
export type Decision = z.infer<typeof DecisionSchema>;

export const RubricVersion = "1.0" as const;

// ═══════════════════════════════════════════════════════════════════
// COMMITTEE OUTPUT
// ═══════════════════════════════════════════════════════════════════

export const CommitteeResultSchema = z.object({
  assessments: z.array(AgentAssessmentSchema),
  decision: DecisionSchema,
  weightedScore: z.number().min(0).max(10),
  fastPath: z.enum(["auto_approve", "auto_reject"]).nullable(),
  disagreements: z.array(DisagreementSchema),
  debateSummary: z.string(),
  rubricVersion: z.string(),
});
export type CommitteeResult = z.infer<typeof CommitteeResultSchema>;

// ═══════════════════════════════════════════════════════════════════
// DOSSIER BUILDER
// ═══════════════════════════════════════════════════════════════════

export const DossierOutputSchema = z.object({
  company: z.string().min(1).max(200),
  industry: z.string().min(1).max(100),
  summary: z.string().min(20).max(1000),
  technology: z.string().max(500).optional(),
  competitors: z.array(z.string()).max(10).optional(),
  fundingStatus: z.string().max(100).optional(),
  pricingModel: z.string().max(200).optional(),
  targetMarket: z.string().max(500).optional(),
  businessModel: z.string().max(500).optional(),
  teamBackground: z.string().max(500).optional(),
});
export type DossierOutput = z.infer<typeof DossierOutputSchema>;

// ═══════════════════════════════════════════════════════════════════
// REPORT BUILDER
// ═══════════════════════════════════════════════════════════════════

export const ReportOutputSchema = z.object({
  schemaVersion: z.string().default("1.0"),
  subjectType: z.enum(["candidate", "idea_evaluation"]),
  generatedAt: z.string(),
  executiveSummary: z.string().min(20).max(1500),
  sections: z.array(
    z.object({
      title: z.string(),
      body: z.string(),
    })
  ),
  committee: z.object({
    weightedScore: z.number(),
    decision: DecisionSchema,
    disagreements: z.array(DisagreementSchema),
    rubricVersion: z.string(),
  }),
  evidence: z.array(
    z.object({
      id: z.string(),
      claim: z.string(),
      sourceUrl: z.string().optional(),
      supportLevel: z.string().optional(),
    })
  ),
  unknowns: z.array(z.string()),
  disclaimer: z.string(),
});
export type ReportOutput = z.infer<typeof ReportOutputSchema>;