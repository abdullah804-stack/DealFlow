import { z } from "zod";
import { callLLMJson } from "@/lib/ai/client";
import {
  AgentAssessmentSchema,
  type AgentType,
  type AgentAssessment,
  type EvaluationInput,
} from "../contracts";

/**
 * Shared runner for all 5 specialist agents.
 * Each specialist provides its own system prompt and persona config.
 */

export type PersonaConfig = {
  agentType: AgentType;
  name: string;
  goal: string;
  caresAbout: string;
};

export async function runSpecialist(
  persona: PersonaConfig,
  input: EvaluationInput
): Promise<AgentAssessment> {
  const context = buildDossierContext(input);
  const systemPrompt = buildSystemPrompt(persona);

  const prompt = `You are evaluating this startup as ${persona.name}.

${context}

Score the startup from 0 to 10 based on your specific concerns.
Return valid json with these fields:
{
  "agentType": "${persona.agentType}",
  "score": <number 0-10>,
  "summary": "<2-4 sentence assessment, 20-800 chars>",
  "strengths": ["<up to 6>"],
  "weaknesses": ["<up to 6>"],
  "risks": ["<up to 6>"],
  "assumptions": ["<up to 10>"],
  "evidenceIds": [],
  "unknowns": ["<up to 10, explicitly note what you cannot determine>"],
  "recommendedActions": ["<up to 5>"],
  "confidence": "<low|medium|high>"
}

Be critical but fair. Use "unknowns" for anything the dossier does not support.
`;

  try {
    const raw = await callLLMJson(prompt, systemPrompt, {
      temperature: 0.4,
      maxTokens: 1200,
    });

    const parsed = AgentAssessmentSchema.safeParse(raw);
    if (parsed.success) {
      return parsed.data;
    }

    // Repair once if the model returned slightly off shape
    const repaired = await repairAssessment(raw, persona, input);
    if (repaired) return repaired;

    return fallbackAssessment(persona, `Parse failed: ${parsed.error.message}`);
  } catch (e) {
    return fallbackAssessment(
      persona,
      `LLM call failed: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

// ─── Prompt builders ───────────────────────────────────────────────

function buildDossierContext(input: EvaluationInput): string {
  const d = input.dossier;
  const parts: string[] = [];
  parts.push(`Company: ${d.company}`);
  parts.push(`Industry: ${d.industry}`);
  parts.push(`Summary: ${d.summary}`);
  if (d.technology) parts.push(`Technology: ${d.technology}`);
  if (d.competitors?.length)
    parts.push(`Competitors: ${d.competitors.join(", ")}`);
  if (d.fundingStatus) parts.push(`Funding: ${d.fundingStatus}`);
  if (d.pricingModel) parts.push(`Pricing: ${d.pricingModel}`);
  if (d.targetMarket) parts.push(`Target market: ${d.targetMarket}`);
  if (d.businessModel) parts.push(`Business model: ${d.businessModel}`);
  if (d.teamBackground) parts.push(`Team: ${d.teamBackground}`);
  return parts.join("\n");
}

function buildSystemPrompt(persona: PersonaConfig): string {
  return `You are ${persona.name}, a venture investor specializing in evaluating startups.

Your goal: ${persona.goal}

You care about: ${persona.caresAbout}

When evaluating:
- Be specific about what you like and don't like
- Score 1-3 for major red flags, 4-6 for average, 7-8 for strong, 9-10 for exceptional
- If you cannot determine something from the provided dossier, list it in "unknowns"
- Do not fabricate information

Respond with valid json only.`;
}

// ─── Repair ────────────────────────────────────────────────────────

async function repairAssessment(
  raw: unknown,
  persona: PersonaConfig,
  input: EvaluationInput
): Promise<AgentAssessment | null> {
  try {
    const prompt = `The following JSON was supposed to match this schema but did not:

${JSON.stringify(raw).slice(0, 2000)}

Fix it to match this exact shape:
{
  "agentType": "${persona.agentType}",
  "score": <number 0-10>,
  "summary": "<20-800 chars>",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "risks": ["..."],
  "assumptions": ["..."],
  "evidenceIds": [],
  "unknowns": ["..."],
  "recommendedActions": ["..."],
  "confidence": "<low|medium|high>"
}

Return valid json only.`;

    const repaired = await callLLMJson(
      prompt,
      "You repair malformed JSON. Respond with valid json only.",
      { temperature: 0.0, maxTokens: 800 }
    );
    const parsed = AgentAssessmentSchema.safeParse(repaired);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ─── Fallback ──────────────────────────────────────────────────────

function fallbackAssessment(
  persona: PersonaConfig,
  reason: string
): AgentAssessment {
  return {
    agentType: persona.agentType,
    score: 5.0,
    summary: `Unable to complete assessment: ${reason}. Defaulting to neutral score of 5.`,
    strengths: [],
    weaknesses: [],
    risks: [],
    assumptions: [],
    evidenceIds: [],
    unknowns: ["Entire assessment failed — no reliable signal"],
    recommendedActions: ["Retry the evaluation"],
    confidence: "low",
  };
}