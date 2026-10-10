import type { AgentAssessment, Decision, AgentType } from "./contracts";
import { RUBRIC_V1 } from "./rubric";

/**
 * Voting — deterministic weighted scoring.
 * Port of src/agents/voting.py. Pure code, no LLM calls.
 *
 * CRITICAL: any change to this file must be matched by a change to
 * src/agents/voting.py and vice versa. Byte-identical behavior on the
 * same input is required. See SCHEDULED_JOBS.md.
 */

export type PerInvestor = {
  persona: AgentType;
  name: string;
  score: number;
  weight: number;
  weightedScore: number;
  confidence: string;
};

export type VoteResult = {
  weightedTotal: number;
  decision: Decision;
  perInvestor: PerInvestor[];
  fastPath: "auto_approve" | "auto_reject" | null;
  isFastPath: boolean;
};

const AGENT_DISPLAY_NAME: Record<AgentType, string> = {
  technical: "Technical VC",
  finance: "Finance VC",
  marketing: "Marketing VC",
  legal: "Legal VC",
  founder: "Serial Founder",
};

/**
 * Detect fast-path consensus.
 * Returns null if no fast path applies.
 */
export function checkFastPath(
  scores: number[]
): { fastPath: "auto_approve" | "auto_reject"; decision: Decision } | null {
  if (scores.length === 0) return null;

  const { fastPathConsensusHigh, fastPathConsensusLow } = RUBRIC_V1.thresholds;

  if (scores.every((s) => s >= fastPathConsensusHigh)) {
    return { fastPath: "auto_approve", decision: "INVEST" };
  }
  if (scores.every((s) => s <= fastPathConsensusLow)) {
    return { fastPath: "auto_reject", decision: "PASS" };
  }
  return null;
}

/**
 * Aggregate agent assessments into a weighted decision.
 */
export function aggregateScores(
  assessments: AgentAssessment[]
): VoteResult {
  if (assessments.length === 0) {
    return {
      weightedTotal: 0,
      decision: "PASS",
      perInvestor: [],
      fastPath: null,
      isFastPath: false,
    };
  }

  const perInvestor: PerInvestor[] = [];
  let totalWeighted = 0;
  let totalWeight = 0;

  for (const a of assessments) {
    const weight = RUBRIC_V1.weights[a.agentType] ?? 0;
    const score = Math.max(0, Math.min(10, a.score));
    const weightedScore = score * weight;
    totalWeighted += weightedScore;
    totalWeight += weight;

    perInvestor.push({
      persona: a.agentType,
      name: AGENT_DISPLAY_NAME[a.agentType],
      score,
      weight,
      weightedScore,
      confidence: a.confidence,
    });
  }

  const weightedTotal =
    totalWeight > 0 ? Math.max(0, Math.min(10, totalWeighted / totalWeight)) : 0;

  // Fast-path check
  const scores = perInvestor.map((p) => p.score);
  const fastPathResult = checkFastPath(scores);

  let decision: Decision;
  let fastPath: "auto_approve" | "auto_reject" | null = null;
  let isFastPath = false;

  if (fastPathResult) {
    fastPath = fastPathResult.fastPath;
    decision = fastPathResult.decision;
    isFastPath = true;
  } else {
    // Insufficient evidence check
    const { minUnknownsPerAgent, minAgentsWithUnknowns } =
      RUBRIC_V1.insufficientEvidence;

    const agentsWithEnoughUnknowns = assessments.filter(
      (a) =>
        a.unknowns.length >= minUnknownsPerAgent &&
        a.unknowns.some((u) =>
          RUBRIC_V1.criticalUnknownKeywords.some((kw) =>
            u.toLowerCase().includes(kw)
          )
        )
    ).length;

    if (agentsWithEnoughUnknowns >= minAgentsWithUnknowns) {
      decision = "INSUFFICIENT_EVIDENCE";
    } else if (weightedTotal >= RUBRIC_V1.thresholds.invest) {
      decision = "INVEST";
    } else if (weightedTotal < RUBRIC_V1.thresholds.pass) {
      decision = "PASS";
    } else {
      // Between pass and invest thresholds → PASS with reservations
      decision = "PASS";
    }
  }

  return {
    weightedTotal: Math.round(weightedTotal * 100) / 100,
    decision,
    perInvestor,
    fastPath,
    isFastPath,
  };
}