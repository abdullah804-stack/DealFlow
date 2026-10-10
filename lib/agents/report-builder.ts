import { callLLMJson } from "@/lib/ai/client";
import type {
  DossierOutput,
  AgentAssessment,
  Decision,
  Disagreement,
} from "./contracts";
import { RUBRIC_V1 } from "./rubric";

export type ReportSections = {
  executive_summary: string;
  startup_overview: string;
  competitive_landscape: string;
  technology_analysis: string;
  market_analysis: string;
  financial_analysis: string;
  legal_analysis: string;
  founder_evaluation: string;
  debate_summary: string;
  recommendation: string;
};

export type ReportJson = ReportSections & {
  schemaVersion: string;
  subjectType: "candidate" | "idea_evaluation";
  generatedAt: string;
  company: string;
  decision: Decision;
  weighted_score: number;
  star_rating: number;
  probability_of_success_pct: number;
  biggest_risk: string;
  biggest_advantage: string;
  recommended_check_size: string;
  recommended_stage: string;
  committee: {
    weightedScore: number;
    decision: Decision;
    disagreements: Disagreement[];
    rubricVersion: string;
  };
  source_info: {
    subjectType: "candidate" | "idea_evaluation";
    subjectId: string;
  };
  disclaimer: string;
};

export type ReportBuildInput = {
  subjectType: "candidate" | "idea_evaluation";
  subjectId: string;
  dossier: DossierOutput;
  assessments: AgentAssessment[];
  decision: Decision;
  weightedScore: number;
  disagreements: Disagreement[];
  debateSummary: string;
};

export async function buildReport(
  input: ReportBuildInput
): Promise<ReportJson> {
  const { dossier, assessments, decision, weightedScore, debateSummary } =
    input;

  const scoresBlock = assessments
    .map(
      (a) =>
        `${a.agentType.toUpperCase()} (${a.score.toFixed(1)}/10):\n` +
        `  Summary: ${a.summary}\n` +
        (a.strengths.length ? `  Strengths: ${a.strengths.join("; ")}\n` : "") +
        (a.weaknesses.length ? `  Weaknesses: ${a.weaknesses.join("; ")}\n` : "") +
        (a.risks.length ? `  Risks: ${a.risks.join("; ")}\n` : "") +
        (a.unknowns.length ? `  Unknowns: ${a.unknowns.join("; ")}\n` : "")
    )
    .join("\n");

  const prompt = `Generate a VC-memo-style investment report for ${dossier.company}.

DOSSIER:
- Company: ${dossier.company}
- Industry: ${dossier.industry}
- Summary: ${dossier.summary}
${dossier.technology ? `- Technology: ${dossier.technology}` : ""}
${dossier.competitors?.length ? `- Competitors: ${dossier.competitors.join(", ")}` : ""}
${dossier.fundingStatus ? `- Funding: ${dossier.fundingStatus}` : ""}
${dossier.pricingModel ? `- Pricing: ${dossier.pricingModel}` : ""}
${dossier.targetMarket ? `- Target market: ${dossier.targetMarket}` : ""}
${dossier.businessModel ? `- Business model: ${dossier.businessModel}` : ""}
${dossier.teamBackground ? `- Team: ${dossier.teamBackground}` : ""}

COMMITTEE DECISION:
- Decision: ${decision}
- Weighted score: ${weightedScore.toFixed(2)}/10

SPECIALIST ASSESSMENTS:
${scoresBlock}

DEBATE SUMMARY:
${debateSummary}

Return valid json matching this exact shape:
{
  "executive_summary": "<2-3 sentence overview>",
  "startup_overview": "<what they do, problem solved, market opportunity>",
  "competitive_landscape": "<competitors and differentiation>",
  "technology_analysis": "<technical approach, moat, feasibility>",
  "market_analysis": "<TAM, demand, timing>",
  "financial_analysis": "<business model, revenue potential, unit economics>",
  "legal_analysis": "<regulatory, IP, compliance considerations>",
  "founder_evaluation": "<team quality and execution capability>",
  "debate_summary": "<committee discussion summary>",
  "recommendation": "<final recommendation with rationale>",
  "star_rating": <integer 1-5>,
  "probability_of_success_pct": <integer 0-100>,
  "biggest_risk": "<single biggest risk>",
  "biggest_advantage": "<single biggest advantage>",
  "recommended_check_size": "<e.g. $250k-$500k>",
  "recommended_stage": "<Pre-seed|Seed|Series A>"
}

All string sections must be non-empty. All predictions are LLM-generated estimates, not statistically calibrated.
`;

  let llmOutput: Record<string, unknown> = {};

  try {
    llmOutput = await callLLMJson(
      prompt,
      "You are a VC analyst writing investment memos. Respond with valid json only. Do not fabricate facts — only use the dossier and committee output.",
      { temperature: 0.5, maxTokens: 2200 }
    );
  } catch (e) {
    // We'll fall back to a minimal report assembled from assessments
    console.error("Report LLM failed, using fallback:", e);
  }

  return assembleReport(input, llmOutput);
}

function assembleReport(
  input: ReportBuildInput,
  llm: Record<string, unknown>
): ReportJson {
  const str = (key: string, fallback: string): string => {
    const v = llm[key];
    return typeof v === "string" && v.trim().length > 0 ? v : fallback;
  };

  const num = (key: string, min: number, max: number, fallback: number): number => {
    const v = llm[key];
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) return Math.max(min, Math.min(max, Math.round(n)));
    return fallback;
  };

  const company = input.dossier.company;
  const { decision, weightedScore, assessments } = input;

  // Derive a star rating from weighted score if the LLM didn't provide one
  const defaultStars =
    weightedScore >= 8 ? 5 : weightedScore >= 6.5 ? 4 : weightedScore >= 5 ? 3 : weightedScore >= 3 ? 2 : 1;

  // Find the strongest and weakest assessments to seed default texts
  const sorted = [...assessments].sort((a, b) => b.score - a.score);
  const topRisk =
    sorted.length > 0 && sorted[sorted.length - 1].risks.length > 0
      ? sorted[sorted.length - 1].risks[0]
      : "Uncertain market adoption";
  const topAdvantage =
    sorted.length > 0 && sorted[0].strengths.length > 0
      ? sorted[0].strengths[0]
      : "Founder-market fit";

  return {
    schemaVersion: "1.0",
    subjectType: input.subjectType,
    generatedAt: new Date().toISOString(),
    company,

    executive_summary: str(
      "executive_summary",
      `${company} was evaluated by a five-member investment committee. Decision: ${decision} at a weighted score of ${weightedScore.toFixed(2)}/10.`
    ),
    startup_overview: str(
      "startup_overview",
      input.dossier.summary ?? "No overview available."
    ),
    competitive_landscape: str(
      "competitive_landscape",
      input.dossier.competitors?.length
        ? `Competing with ${input.dossier.competitors.join(", ")}.`
        : "No competitor analysis available."
    ),
    technology_analysis: str(
      "technology_analysis",
      input.dossier.technology ?? "No technology analysis available."
    ),
    market_analysis: str(
      "market_analysis",
      input.dossier.targetMarket ?? "No market analysis available."
    ),
    financial_analysis: str(
      "financial_analysis",
      input.dossier.businessModel ?? "No financial analysis available."
    ),
    legal_analysis: str(
      "legal_analysis",
      "No specific legal analysis available."
    ),
    founder_evaluation: str(
      "founder_evaluation",
      input.dossier.teamBackground ?? "No founder evaluation available."
    ),
    debate_summary: str("debate_summary", input.debateSummary),
    recommendation: str(
      "recommendation",
      `The committee recommends ${decision}.`
    ),

    decision,
    weighted_score: weightedScore,
    star_rating: num("star_rating", 1, 5, defaultStars),
    probability_of_success_pct: num("probability_of_success_pct", 0, 100, 50),
    biggest_risk: str("biggest_risk", topRisk),
    biggest_advantage: str("biggest_advantage", topAdvantage),
    recommended_check_size: str("recommended_check_size", "$250k-$500k"),
    recommended_stage: str("recommended_stage", "Seed"),

    committee: {
      weightedScore,
      decision,
      disagreements: input.disagreements,
      rubricVersion: RUBRIC_V1.version,
    },

    source_info: {
      subjectType: input.subjectType,
      subjectId: input.subjectId,
    },

    disclaimer:
      "All predictions (star rating, probability, check size, stage) are LLM-generated estimates based on available information. They are not statistically calibrated predictions and should not be considered as financial advice.",
  };
}