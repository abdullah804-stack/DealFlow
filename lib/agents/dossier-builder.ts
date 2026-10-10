import { callLLMJson } from "@/lib/ai/client";
import { DossierOutputSchema, type DossierOutput } from "./contracts";

/**
 * Dossier builder for user-submitted ideas.
 *
 * Differs from Python's dossier_builder.py (which is per-candidate from
 * raw scraped text). Here we synthesize a dossier from a completed
 * interview: the intake form + all interview turns.
 *
 * The output feeds the 5 specialist agents and the committee moderator.
 */

export type InterviewTurnForDossier = {
  specialist: string;
  questionKey: string;
  questionText: string;
  answerText: string | null;
  skipped: boolean;
};

export type IntakeForDossier = {
  title: string;
  oneLiner: string;
  problem: string;
  solution: string;
  targetMarket?: string | null;
  businessModel?: string | null;
  teamBackground?: string | null;
  competitors?: string | null;
  fundingStage?: string | null;
  askAmount?: string | null;
};

export async function buildDossier(
  intake: IntakeForDossier,
  turns: InterviewTurnForDossier[]
): Promise<DossierOutput> {
  const interviewBlock = turns
    .filter((t) => t.answerText && t.answerText.trim().length > 0)
    .map(
      (t) =>
        `[${t.specialist}] Q: ${t.questionText}\nA: ${t.answerText}\n`
    )
    .join("\n");

  const prompt = `You are assembling a structured investment dossier from a founder's intake form and their interview answers.

INTAKE FORM:
- Title: ${intake.title}
- One-liner: ${intake.oneLiner}
- Problem: ${intake.problem}
- Solution: ${intake.solution}
${intake.targetMarket ? `- Target market: ${intake.targetMarket}` : ""}
${intake.businessModel ? `- Business model: ${intake.businessModel}` : ""}
${intake.teamBackground ? `- Team: ${intake.teamBackground}` : ""}
${intake.competitors ? `- Competitors (as stated): ${intake.competitors}` : ""}
${intake.fundingStage ? `- Funding stage: ${intake.fundingStage}` : ""}
${intake.askAmount ? `- Ask: ${intake.askAmount}` : ""}

INTERVIEW ANSWERS:
${interviewBlock}

Synthesize a dossier. Return valid json matching exactly:
{
  "company": "<the startup's name, from the title>",
  "industry": "<one of: FinTech, HealthTech, SaaS, AI/ML, Marketplace, Dev Tools, EdTech, LegalTech, Other>",
  "summary": "<2-4 sentences summarizing what they do, 20-1000 chars>",
  "technology": "<key technologies, or omit if unknown>",
  "competitors": ["<up to 10 real competitor names, or omit if none stated>"],
  "fundingStatus": "<current stage, or omit>",
  "pricingModel": "<how they charge, or omit>",
  "targetMarket": "<who they sell to, or omit>",
  "businessModel": "<revenue mechanism, or omit>",
  "teamBackground": "<founding team summary, or omit>"
}

Do NOT fabricate. If a field cannot be determined from the inputs, omit it.
Only include the "competitors" array if the founder named actual competitors.
`;

  try {
    const raw = await callLLMJson(
      prompt,
      "You are a VC analyst assembling structured dossiers. Respond with valid json only. Never fabricate information.",
      { temperature: 0.2, maxTokens: 1000 }
    );

    const parsed = DossierOutputSchema.safeParse(raw);
    if (parsed.success) return parsed.data;

    // Fallback: build a minimal dossier from intake
    return minimalDossier(intake);
  } catch {
    return minimalDossier(intake);
  }
}

function minimalDossier(intake: IntakeForDossier): DossierOutput {
  const summary = `${intake.oneLiner} ${intake.problem} ${intake.solution}`
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 990);

  return {
    company: intake.title.slice(0, 200),
    industry: "Other",
    summary: summary.length >= 20 ? summary : intake.oneLiner.slice(0, 990),
    ...(intake.targetMarket ? { targetMarket: intake.targetMarket } : {}),
    ...(intake.businessModel ? { businessModel: intake.businessModel } : {}),
    ...(intake.teamBackground ? { teamBackground: intake.teamBackground } : {}),
    ...(intake.fundingStage ? { fundingStatus: intake.fundingStage } : {}),
    ...(intake.competitors
      ? { competitors: intake.competitors.split(",").map((c) => c.trim()).filter(Boolean).slice(0, 10) }
      : {}),
  };
}
