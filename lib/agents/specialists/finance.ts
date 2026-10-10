import { runSpecialist, type PersonaConfig } from "./base";
import type { EvaluationInput, AgentAssessment } from "../contracts";

const persona: PersonaConfig = {
  agentType: "finance",
  name: "Finance VC",
  goal: "Determine business model profitability",
  caresAbout:
    "revenue, CAC, LTV, burn rate, TAM, unit economics, path to profitability",
};

export function financeAgent(
  input: EvaluationInput
): Promise<AgentAssessment> {
  return runSpecialist(persona, input);
}