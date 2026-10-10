import { runSpecialist, type PersonaConfig } from "./base";
import type { EvaluationInput, AgentAssessment } from "../contracts";

const persona: PersonaConfig = {
  agentType: "technical",
  name: "Technical VC",
  goal: "Determine defensible technical moat",
  caresAbout:
    "scalability, architecture, AI feasibility, technical differentiation, competition",
};

export function technicalAgent(
  input: EvaluationInput
): Promise<AgentAssessment> {
  return runSpecialist(persona, input);
}