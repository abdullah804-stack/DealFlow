import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════
// SPECIALISTS
// ═══════════════════════════════════════════════════════════════════

export const SpecialistSchema = z.enum([
  "technical",
  "finance",
  "marketing",
  "legal",
  "founder",
]);
export type Specialist = z.infer<typeof SpecialistSchema>;

// ═══════════════════════════════════════════════════════════════════
// INTAKE
// ═══════════════════════════════════════════════════════════════════

export const IntakeSchema = z.object({
  title: z.string().min(3).max(200),
  oneLiner: z.string().min(10).max(500),
  problem: z.string().min(20).max(2000),
  solution: z.string().min(20).max(2000),
  targetMarket: z.string().max(1000).optional(),
  businessModel: z.string().max(1000).optional(),
  teamBackground: z.string().max(1000).optional(),
  competitors: z.string().max(1000).optional(),
  fundingStage: z.string().max(100).optional(),
  askAmount: z.string().max(100).optional(),
});
export type Intake = z.infer<typeof IntakeSchema>;

// ═══════════════════════════════════════════════════════════════════
// ANSWER
// ═══════════════════════════════════════════════════════════════════

export const AnswerSchema = z.object({
  turnIndex: z.number().int().min(0),
  answerText: z.string().max(2000),
});
export type Answer = z.infer<typeof AnswerSchema>;

export const SkipSchema = z.object({
  turnIndex: z.number().int().min(0),
});
export type Skip = z.infer<typeof SkipSchema>;

// ═══════════════════════════════════════════════════════════════════
// LLM OUTPUT — turn generator contract
// ═══════════════════════════════════════════════════════════════════

export const TurnGeneratorOutputSchema = z.object({
  nextQuestionKey: z.string().min(1).max(100),
  questionText: z.string().min(10).max(600),
  isClarification: z.boolean(),
});
export type TurnGeneratorOutput = z.infer<typeof TurnGeneratorOutputSchema>;

// ═══════════════════════════════════════════════════════════════════
// RESPONSE ENVELOPES
// ═══════════════════════════════════════════════════════════════════

export const IdeaEvaluationStatusSchema = z.enum([
  "intake",
  "interviewing",
  "review",
  "evaluating",
  "complete",
  "failed_partial",
]);
export type IdeaEvaluationStatus = z.infer<typeof IdeaEvaluationStatusSchema>;

export const InterviewSessionStatusSchema = z.enum([
  "interviewing",
  "review",
  "complete",
]);
export type InterviewSessionStatus = z.infer<
  typeof InterviewSessionStatusSchema
>;