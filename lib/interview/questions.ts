import type { Specialist } from "./schema";

/**
 * The 25 locked interview questions — 5 per specialist.
 *
 * Each question has:
 * - key: stable identifier (never change once used, breaks existing interviews)
 * - specialist: which investor persona asked it
 * - prompt: base text (LLM personalizes per idea but must not change intent)
 * - required: if true, user cannot skip; if false, skip is allowed
 *
 * The turn generator personalizes wording but MUST return the same key.
 * The pipeline rejects any turn whose key is not in this list.
 */

export type Question = {
  key: string;
  specialist: Specialist;
  prompt: string;
  required: boolean;
};

export const QUESTIONS: Question[] = [
  // ─── Technical (5) ───────────────────────────────────────────────
  {
    key: "tech_001",
    specialist: "technical",
    prompt:
      "What is the core technical mechanism that makes your product work, and what would be hard for a competitor to replicate within 12 months?",
    required: true,
  },
  {
    key: "tech_002",
    specialist: "technical",
    prompt:
      "Walk me through the architecture. What are the three most technically risky components and how do you plan to de-risk each?",
    required: true,
  },
  {
    key: "tech_003",
    specialist: "technical",
    prompt:
      "What is your data strategy? Do you generate, buy, or collect proprietary data, and how does that create defensibility?",
    required: true,
  },
  {
    key: "tech_004",
    specialist: "technical",
    prompt:
      "What is your current build stage? Do you have a working prototype, an MVP with real users, or production traffic?",
    required: true,
  },
  {
    key: "tech_005",
    specialist: "technical",
    prompt:
      "If a well-funded competitor cloned your product in 6 months, what would still keep your customers from switching?",
    required: false,
  },

  // ─── Finance (5) ─────────────────────────────────────────────────
  {
    key: "fin_001",
    specialist: "finance",
    prompt:
      "What is your pricing model today, and how did you arrive at that number? If you haven't priced yet, what's your hypothesis?",
    required: true,
  },
  {
    key: "fin_002",
    specialist: "finance",
    prompt:
      "What does the path to $1M ARR look like? How many customers, at what ACV, and over what timeframe?",
    required: true,
  },
  {
    key: "fin_003",
    specialist: "finance",
    prompt:
      "What's your customer acquisition cost today, or what's your best estimate if you're pre-revenue?",
    required: true,
  },
  {
    key: "fin_004",
    specialist: "finance",
    prompt:
      "How much runway do you have, what's your current monthly burn, and what does this round buy you?",
    required: true,
  },
  {
    key: "fin_005",
    specialist: "finance",
    prompt:
      "What is the biggest financial assumption in your model that, if wrong, would break the business case?",
    required: false,
  },

  // ─── Marketing (5) ───────────────────────────────────────────────
  {
    key: "mkt_001",
    specialist: "marketing",
    prompt:
      "Who is your exact target customer? Describe them by role, company size, or another specific attribute — not 'everyone'.",
    required: true,
  },
  {
    key: "mkt_002",
    specialist: "marketing",
    prompt:
      "How are you reaching them today? What channel is working, and what's the cost per acquisition?",
    required: true,
  },
  {
    key: "mkt_003",
    specialist: "marketing",
    prompt:
      "Name three direct competitors and one thing you do better than each of them.",
    required: true,
  },
  {
    key: "mkt_004",
    specialist: "marketing",
    prompt:
      "What evidence do you have that this market actually wants what you're building? Users, waitlist, LOIs, revenue?",
    required: true,
  },
  {
    key: "mkt_005",
    specialist: "marketing",
    prompt:
      "If you had to pick one channel and abandon all others for the next 12 months, which would it be and why?",
    required: false,
  },

  // ─── Legal (5) ───────────────────────────────────────────────────
  {
    key: "leg_001",
    specialist: "legal",
    prompt:
      "What regulatory regime applies to your product, and what is your plan for staying compliant as you scale?",
    required: true,
  },
  {
    key: "leg_002",
    specialist: "legal",
    prompt:
      "Do you process personal data? If so, which privacy regulations (GDPR, CCPA, HIPAA, etc.) apply and how are you addressing them?",
    required: true,
  },
  {
    key: "leg_003",
    specialist: "legal",
    prompt:
      "Who owns the IP you've built so far? Are there any contractor or founder agreements that could create ambiguity?",
    required: true,
  },
  {
    key: "leg_004",
    specialist: "legal",
    prompt:
      "Are there any third-party dependencies (open-source licenses, model providers, data sources) that could create legal risk?",
    required: true,
  },
  {
    key: "leg_005",
    specialist: "legal",
    prompt:
      "Have you formed a legal entity, and in which jurisdiction? Any plans for Delaware C-Corp or international structure?",
    required: false,
  },

  // ─── Founder (5) ─────────────────────────────────────────────────
  {
    key: "fnd_001",
    specialist: "founder",
    prompt:
      "Who is on the founding team, what have they built before, and why are they the right people to solve this specific problem?",
    required: true,
  },
  {
    key: "fnd_002",
    specialist: "founder",
    prompt:
      "What is the smallest version of this product you could ship in the next 30 days, and what would you cut from your current plan to make it?",
    required: true,
  },
  {
    key: "fnd_003",
    specialist: "founder",
    prompt:
      "What is the biggest risk you personally worry about, and what are you doing this quarter to address it?",
    required: true,
  },
  {
    key: "fnd_004",
    specialist: "founder",
    prompt:
      "How many hours a week is the team working on this, and is anyone doing it full-time yet?",
    required: true,
  },
  {
    key: "fnd_005",
    specialist: "founder",
    prompt:
      "What would have to be true 6 months from now for you to know this is working — or to conclude it's not?",
    required: false,
  },
];

// ─── Lookup helpers ────────────────────────────────────────────────

export const QUESTIONS_BY_KEY: Record<string, Question> = Object.fromEntries(
  QUESTIONS.map((q) => [q.key, q])
);

export const QUESTIONS_BY_SPECIALIST: Record<Specialist, Question[]> = {
  technical: QUESTIONS.filter((q) => q.specialist === "technical"),
  finance: QUESTIONS.filter((q) => q.specialist === "finance"),
  marketing: QUESTIONS.filter((q) => q.specialist === "marketing"),
  legal: QUESTIONS.filter((q) => q.specialist === "legal"),
  founder: QUESTIONS.filter((q) => q.specialist === "founder"),
};

export const TOTAL_QUESTIONS = QUESTIONS.length; // 25
export const REQUIRED_QUESTIONS = QUESTIONS.filter((q) => q.required).length;
export const SKIPPABLE_QUESTIONS = QUESTIONS.filter((q) => !q.required).length;

export function isValidQuestionKey(key: string): boolean {
  return key in QUESTIONS_BY_KEY;
}