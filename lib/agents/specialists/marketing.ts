import { runSpecialist, type PersonaConfig } from "./base";
import type { EvaluationInput, AgentAssessment } from "../contracts";

const persona: PersonaConfig = {
  agentType: "marketing",
  name: "Marketing VC",
  goal: "Determine real market demand and differentiation",
  caresAbout:
    "positioning, customer demand, differentiation, channel strategy, GTM",
};

export function marketingAgent(
  input: EvaluationInput
): Promise<AgentAssessment> {
  return runSpecialist(persona, input);
}