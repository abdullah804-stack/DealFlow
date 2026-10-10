import { runSpecialist, type PersonaConfig } from "./base";
import type { EvaluationInput, AgentAssessment } from "../contracts";

const persona: PersonaConfig = {
  agentType: "founder",
  name: "Serial Founder",
  goal: "Determine execution feasibility",
  caresAbout:
    "MVP scope, hiring plan, execution speed, team credibility, founder-market fit",
};

export function founderAgent(input: EvaluationInput): Promise<AgentAssessment> {
  return runSpecialist(persona, input);
}