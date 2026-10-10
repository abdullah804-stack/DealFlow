import { prisma } from "@/lib/prisma";
import { buildDossier, type IntakeForDossier, type InterviewTurnForDossier } from "./dossier-builder";
import { runCommittee, type CommitteeRoundResult } from "./moderator";
import { aggregateScores } from "./voting";
import { buildReport, type ReportJson } from "./report-builder";
import { RUBRIC_V1 } from "./rubric";
import type { AgentAssessment, EvaluationInput } from "./contracts";

/**
 * Top-level committee orchestrator for user-submitted ideas.
 *
 * Pipeline:
 *   1. Build dossier from intake + interview turns
 *   2. Run 5 specialists (round 1, fast-path, round 2)
 *   3. Aggregate votes → weighted decision
 *   4. Persist assessments + decision
 *   5. Build report JSON
 *   6. Persist report
 *   7. Update IdeaEvaluation status → complete
 *   8. Update linked Candidate status
 *
 * Called from /api/v1/idea-evaluations/[id]/evaluation/start
 */

export type RunCommitteeForEvaluationResult = {
  evaluationId: string;
  candidateId: string;
  decision: string;
  weightedScore: number;
  reportId: string;
};

export async function runCommitteeForEvaluation(
  evaluationId: string
): Promise<RunCommitteeForEvaluationResult> {
  // ─── 1. Load evaluation + session + turns ───────────────────────
  const evaluation = await prisma.ideaEvaluation.findUnique({
    where: { id: evaluationId },
    include: {
      session: {
        include: { turns: { orderBy: { turnIndex: "asc" } } },
      },
    },
  });

  if (!evaluation) throw new Error("Evaluation not found");
  if (!evaluation.session) throw new Error("Session not found");

  // ─── 2. Ensure a Candidate row exists for this evaluation ──────
  const candidateId = await ensureCandidate(evaluation);

  // ─── 3. Build dossier ──────────────────────────────────────────
  const intake: IntakeForDossier = {
    title: evaluation.title,
    oneLiner: evaluation.oneLiner,
    problem: evaluation.problem,
    solution: evaluation.solution,
    targetMarket: evaluation.targetMarket,
    businessModel: evaluation.businessModel,
    teamBackground: evaluation.teamBackground,
    competitors: evaluation.competitors,
    fundingStage: evaluation.fundingStage,
    askAmount: evaluation.askAmount,
  };

  const turnsForDossier: InterviewTurnForDossier[] = evaluation.session.turns
    .filter((t) => t.answerText && t.answerText.trim().length > 0)
    .map((t) => ({
      specialist: t.specialist,
      questionKey: t.questionKey,
      questionText: t.questionText,
      answerText: t.answerText,
      skipped: t.skipped,
    }));

  const dossier = await buildDossier(intake, turnsForDossier);

  // ─── 4. Persist dossier row ────────────────────────────────────
  const dossierRow = await prisma.dossier.create({
    data: {
      candidateId,
      dossierJson: dossier as object,
      company: dossier.company,
      industry: dossier.industry,
      technology: dossier.technology ?? null,
      competitors: dossier.competitors ?? undefined,
      fundingStatus: dossier.fundingStatus ?? null,
      pricingModel: dossier.pricingModel ?? null,
      summary: dossier.summary,
    },
  });

  // ─── 5. Run the committee ──────────────────────────────────────
  const evalInput: EvaluationInput = {
    subjectType: "idea_evaluation",
    subjectId: evaluationId,
    dossier: {
      company: dossier.company,
      industry: dossier.industry,
      summary: dossier.summary,
      technology: dossier.technology,
      competitors: dossier.competitors,
      fundingStatus: dossier.fundingStatus,
      pricingModel: dossier.pricingModel,
      targetMarket: dossier.targetMarket,
      businessModel: dossier.businessModel,
      teamBackground: dossier.teamBackground,
    },
    evidence: [],
  };

  const roundResult: CommitteeRoundResult = await runCommittee(evalInput);

  // ─── 6. Determine final assessments (round 2 if it ran) ────────
  const finalAssessments =
    roundResult.round2.length > 0 ? roundResult.round2 : roundResult.round1;

  // ─── 7. Aggregate votes ────────────────────────────────────────
  const voteResult = aggregateScores(finalAssessments);

  // ─── 8. Persist assessments ────────────────────────────────────
  await persistAssessments(candidateId, roundResult.round1, 1);
  if (roundResult.round2.length > 0) {
    await persistAssessments(candidateId, roundResult.round2, 2);
  }

  // ─── 9. Persist committee decision ─────────────────────────────
  const decisionRow = await prisma.committeeDecision.create({
    data: {
      candidateId,
      dossierId: dossierRow.id,
      decision: voteResult.decision,
      weightedScore: voteResult.weightedTotal,
      fastPath: voteResult.fastPath,
      rubricVersion: RUBRIC_V1.version,
      round1Opinions: roundResult.round1 as unknown as object,
      round2Opinions:
        roundResult.round2.length > 0
          ? (roundResult.round2 as unknown as object)
          : undefined,
      debateSummary: roundResult.debateSummary,
    },
  });

  // ─── 10. Build report ──────────────────────────────────────────
  const reportJson: ReportJson = await buildReport({
    subjectType: "idea_evaluation",
    subjectId: evaluationId,
    dossier,
    assessments: finalAssessments,
    decision: voteResult.decision,
    weightedScore: voteResult.weightedTotal,
    disagreements: roundResult.disagreements,
    debateSummary: roundResult.debateSummary,
  });

  // ─── 11. Persist report ────────────────────────────────────────
  const reportRow = await prisma.report.create({
    data: {
      candidateId,
      dossierId: dossierRow.id,
      decisionId: decisionRow.id,
      subjectType: "idea_evaluation",
      schemaVersion: "1.0",
      reportJson: reportJson as unknown as object,
      company: dossier.company,
      decision: voteResult.decision,
      weightedScore: voteResult.weightedTotal,
      starRating: reportJson.star_rating,
    },
  });

  // ─── 12. Update evaluation + session status ────────────────────
  await prisma.ideaEvaluation.update({
    where: { id: evaluationId },
    data: {
      status: "complete",
      candidateId,
    },
  });

  await prisma.interviewSession.update({
    where: { id: evaluation.session.id },
    data: { status: "complete" },
  });

  return {
    evaluationId,
    candidateId,
    decision: voteResult.decision,
    weightedScore: voteResult.weightedTotal,
    reportId: reportRow.id,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

async function ensureCandidate(evaluation: {
  id: string;
  title: string;
  oneLiner: string;
  problem: string;
  solution: string;
  candidateId: string | null;
}): Promise<string> {
  if (evaluation.candidateId) {
    // Already linked — reuse
    const existing = await prisma.candidate.findUnique({
      where: { id: evaluation.candidateId },
      select: { id: true },
    });
    if (existing) return existing.id;
  }

  // Create a synthetic candidate for this idea. Use a canonicalKey derived
  // from the evaluation id so it can't collide with a scraped candidate.
  const canonicalKey = `idea_evaluation:${evaluation.id}`;

  const existingByKey = await prisma.candidate.findUnique({
    where: { canonicalKey },
    select: { id: true },
  });
  if (existingByKey) return existingByKey.id;

  const created = await prisma.candidate.create({
    data: {
      canonicalKey,
      title: evaluation.title,
      url: `internal://idea-evaluation/${evaluation.id}`,
      source: "idea_evaluation",
      rawText: `${evaluation.oneLiner}\n\n${evaluation.problem}\n\n${evaluation.solution}`,
      isRealStartup: true,
      discoveryConfidence: null,
      finalConfidence: null,
    },
  });

  return created.id;
}

async function persistAssessments(
  candidateId: string,
  assessments: AgentAssessment[],
  round: number
): Promise<void> {
  for (const a of assessments) {
    await prisma.agentAssessment.create({
      data: {
        candidateId,
        agentType: a.agentType,
        round,
        score: a.score,
        confidence: confidenceToNumber(a.confidence),
        summary: a.summary,
        strengths: a.strengths,
        weaknesses: a.weaknesses,
        risks: a.risks,
        assumptions: a.assumptions,
        unknowns: a.unknowns,
        recommendedActions: a.recommendedActions,
        evidenceIds: a.evidenceIds,
      },
    });
  }
}

function confidenceToNumber(c: "low" | "medium" | "high"): number {
  return c === "high" ? 9 : c === "medium" ? 6 : 3;
}