import { runSpecialist, type PersonaConfig } from "./base";
import type { EvaluationInput, AgentAssessment } from "../contracts";

const persona: PersonaConfig = {
  agentType: "legal",
  name: "Legal VC",
  goal: "Determine compliance and regulatory risk",
  caresAbout:
    "privacy, GDPR, CCPA, copyright, IP ownership, regulatory exposure",
};

export function legalAgent(input: EvaluationInput): Promise<AgentAssessment> {
  return runSpecialist(persona, input);
}