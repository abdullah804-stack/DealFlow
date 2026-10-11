/**
 * Voting parity test — TS side.
 * Prints output in the same canonical format as tests/test_voting_parity.py.
 */

import { aggregateScores } from "../lib/agents/voting";
import type { AgentAssessment } from "../lib/agents/contracts";

type Case = {
  name: string;
  scores: Record<string, number>;
};

const CASES: Case[] = [
  {
    name: "mixed",
    scores: {
      technical: 8.0,
      finance: 7.0,
      marketing: 6.5,
      legal: 5.5,
      founder: 7.5,
    },
  },
  {
    name: "unanimous_high",
    scores: {
      technical: 9.0,
      finance: 9.0,
      marketing: 9.0,
      legal: 9.0,
      founder: 9.0,
    },
  },
  {
    name: "unanimous_low",
    scores: {
      technical: 2.0,
      finance: 2.0,
      marketing: 2.0,
      legal: 2.0,
      founder: 2.0,
    },
  },
];

function toAssessments(
  scores: Record<string, number>
): AgentAssessment[] {
  return Object.entries(scores).map(([agentType, score]) => ({
    agentType: agentType as AgentAssessment["agentType"],
    score,
    summary: "Test fixture summary that meets the min length requirement.",
    strengths: [],
    weaknesses: [],
    risks: [],
    assumptions: [],
    evidenceIds: [],
    unknowns: [],
    recommendedActions: [],
    confidence: "medium" as const,
  }));
}

const results = CASES.map((c) => {
  const r = aggregateScores(toAssessments(c.scores));
  return {
    name: c.name,
    weightedTotal: Math.round(r.weightedTotal * 10000) / 10000,
    decision: r.decision,
    fastPath: r.fastPath,
  };
});

console.log("VOTING_PARITY_JSON_START");
console.log(JSON.stringify(results, Object.keys(results[0]).sort(), 2));
console.log("VOTING_PARITY_JSON_END");