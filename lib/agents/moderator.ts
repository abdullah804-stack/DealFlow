import { callLLMJson } from "@/lib/ai/client";
import {
  ModeratorOutputSchema,
  type AgentAssessment,
  type EvaluationInput,
  type Disagreement,
  type ModeratorOutput,
  type AgentType,
} from "./contracts";
import { checkFastPath } from "./voting";
import { technicalAgent } from "./specialists/technical";
import { financeAgent } from "./specialists/finance";
import { marketingAgent } from "./specialists/marketing";
import { legalAgent } from "./specialists/legal";
import { founderAgent } from "./specialists/founder";

/**
 * Moderator — orchestrates the committee.
 * Round 1: 5 specialists in parallel.
 * Fast-path: skip round 2 if all scores high or all low.
 * Otherwise round 2: specialist reflections after hearing each other.
 *
 * Round 2 in the new plan is reflection, not rebuttal. We implement it as a
 * lighter LLM pass: each specialist sees the other four scores and short
 * summaries and either confirms or adjusts. This differs from the Python
 * side, which uses a fuller rebuttal prompt. The vote uses round 2 scores
 * if round 2 ran.
 */

export type CommitteeRoundResult = {
  round1: AgentAssessment[];
  round2: AgentAssessment[];
  fastPath: "auto_approve" | "auto_reject" | null;
  disagreements: Disagreement[];
  debateSummary: string;
};

const AGENT_ORDER: AgentType[] = [
  "technical",
  "finance",
  "marketing",
  "legal",
  "founder",
];

const AGENT_DISPLAY: Record<AgentType, string> = {
  technical: "Technical VC",
  finance: "Finance VC",
  marketing: "Marketing VC",
  legal: "Legal VC",
  founder: "Serial Founder",
};

// ─── Round 1 ───────────────────────────────────────────────────────

async function runRound1(input: EvaluationInput): Promise<AgentAssessment[]> {
  const [tech, fin, mkt, legal, founder] = await Promise.all([
    technicalAgent(input),
    financeAgent(input),
    marketingAgent(input),
    legalAgent(input),
    founderAgent(input),
  ]);

  // Enforce a stable order regardless of resolution order
  const byType: Partial<Record<AgentType, AgentAssessment>> = {
    technical: tech,
    finance: fin,
    marketing: mkt,
    legal: legal,
    founder: founder,
  };
  return AGENT_ORDER.map((t) => byType[t]!).filter(Boolean);
}

// ─── Round 2 ───────────────────────────────────────────────────────

async function runRound2(
  input: EvaluationInput,
  round1: AgentAssessment[]
): Promise<AgentAssessment[]> {
  const scoresLine = round1
    .map((a) => `${AGENT_DISPLAY[a.agentType]}: ${a.score.toFixed(1)}/10 — ${a.summary.slice(0, 150)}`)
    .join("\n");

  const results = await Promise.all(
    round1.map(async (own) => {
      const othersText = round1
        .filter((a) => a.agentType !== own.agentType)
        .map(
          (a) =>
            `${AGENT_DISPLAY[a.agentType]}: ${a.score.toFixed(1)}/10 — ${a.summary.slice(0, 150)}`
        )
        .join("\n");

      const prompt = `You previously scored this startup. You are ${AGENT_DISPLAY[own.agentType]}.

YOUR INITIAL ASSESSMENT:
Score: ${own.score.toFixed(1)}/10
Summary: ${own.summary}

OTHER INVESTORS:
${othersText}

Considering their perspectives, either confirm or adjust your score.
Return valid json:
{
  "agentType": "${own.agentType}",
  "score": <number 0-10>,
  "summary": "<keep or update, 20-800 chars>",
  "strengths": ${JSON.stringify(own.strengths)},
  "weaknesses": ${JSON.stringify(own.weaknesses)},
  "risks": ${JSON.stringify(own.risks)},
  "assumptions": ${JSON.stringify(own.assumptions)},
  "evidenceIds": [],
  "unknowns": ${JSON.stringify(own.unknowns)},
  "recommendedActions": ${JSON.stringify(own.recommendedActions)},
  "confidence": "${own.confidence}"
}

Only change what you genuinely reconsidered. Return valid json only.`;

      try {
        const raw = await callLLMJson(
          prompt,
          `${buildSystemHint(own.agentType)}\n\nRespond with valid json only.`,
          { temperature: 0.3, maxTokens: 1000 }
        );

        // Preserve the shape from round 1 if parse fails
        const merged = {
          ...own,
          ...(typeof raw === "object" && raw !== null ? raw : {}),
          agentType: own.agentType,
          evidenceIds: [],
        };
        return merged as AgentAssessment;
      } catch {
        return own;
      }
    })
  );

  return results;
}

function buildSystemHint(agentType: AgentType): string {
  const map: Record<AgentType, string> = {
    technical:
      "You are the Technical VC. Focus on moat, architecture, feasibility.",
    finance:
      "You are the Finance VC. Focus on unit economics, TAM, path to profit.",
    marketing:
      "You are the Marketing VC. Focus on demand, positioning, differentiation.",
    legal:
      "You are the Legal VC. Focus on regulation, privacy, IP, compliance.",
    founder:
      "You are the Serial Founder. Focus on execution, hiring, MVP scope.",
  };
  return map[agentType];
}

// ─── Disagreement detection ────────────────────────────────────────

function detectDisagreements(
  assessments: AgentAssessment[]
): Disagreement[] {
  const scores = assessments.map((a) => a.score);
  const max = Math.max(...scores);
  const min = Math.min(...scores);

  // If scores are within 2.5 points, no meaningful disagreement
  if (max - min < 2.5) return [];

  const high = assessments.filter((a) => a.score >= max - 1);
  const low = assessments.filter((a) => a.score <= min + 1);

  return [
    {
      topic: "Overall investment thesis",
      positions: [
        ...high.map((a) => ({
          agentType: a.agentType,
          position: `Bullish (${a.score.toFixed(1)}/10): ${a.summary.slice(0, 200)}`,
        })),
        ...low.map((a) => ({
          agentType: a.agentType,
          position: `Bearish (${a.score.toFixed(1)}/10): ${a.summary.slice(0, 200)}`,
        })),
      ],
    },
  ];
}

// ─── Debate summary ────────────────────────────────────────────────

async function buildDebateSummary(
  input: EvaluationInput,
  assessments: AgentAssessment[],
  disagreements: Disagreement[]
): Promise<string> {
  const company = input.dossier.company;
  const scoresText = assessments
    .map((a) => `${AGENT_DISPLAY[a.agentType]}: ${a.score.toFixed(1)}/10`)
    .join("\n");

  const disText =
    disagreements.length > 0
      ? disagreements
          .map(
            (d) =>
              `Topic: ${d.topic}\n` +
              d.positions
                .map((p) => `  ${AGENT_DISPLAY[p.agentType]}: ${p.position}`)
                .join("\n")
          )
          .join("\n\n")
      : "No significant disagreements.";

  const prompt = `Summarize the investment committee debate for ${company}.

INDIVIDUAL SCORES:
${scoresText}

DISAGREEMENTS:
${disText}

Write 3-4 concise paragraphs covering:
1. Points of agreement
2. Points of disagreement
3. How the committee reached its conclusion

Keep it professional. Return plain text, not JSON.`;

  try {
    const raw = await callLLMJson(
      prompt + "\n\nReturn valid json: { \"summary\": \"...\" }",
      "You are the committee moderator. Respond with valid json only.",
      { temperature: 0.4, maxTokens: 800 }
    );
    const parsed = ModeratorOutputSchema.safeParse(raw);
    if (parsed.success) return parsed.data.summary;

    if (typeof raw === "object" && raw !== null && "summary" in raw) {
      return String((raw as { summary: unknown }).summary);
    }
  } catch {
    // fall through
  }

  return `The committee evaluated ${company}. ${assessments.length} specialists provided scores ranging from ${Math.min(...assessments.map((a) => a.score)).toFixed(1)} to ${Math.max(...assessments.map((a) => a.score)).toFixed(1)}.`;
}

// ─── Public API ────────────────────────────────────────────────────

export async function runCommittee(
  input: EvaluationInput
): Promise<CommitteeRoundResult> {
  const round1 = await runRound1(input);

  const scores = round1.map((a) => a.score);
  const fastPathResult = checkFastPath(scores);

  if (fastPathResult) {
    return {
      round1,
      round2: [],
      fastPath: fastPathResult.fastPath,
      disagreements: [],
      debateSummary: `Fast-path triggered: ${fastPathResult.fastPath}. All specialists reached consensus on ${input.dossier.company}.`,
    };
  }

  const round2 = await runRound2(input, round1);
  const disagreements = detectDisagreements(round2);
  const debateSummary = await buildDebateSummary(input, round2, disagreements);

  return {
    round1,
    round2,
    fastPath: null,
    disagreements,
    debateSummary,
  };
}