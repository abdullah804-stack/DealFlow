import { z } from "zod";
import {
  QUESTIONS,
  QUESTIONS_BY_KEY,
  QUESTIONS_BY_SPECIALIST,
  isValidQuestionKey,
} from "./questions";
import type { Specialist } from "./schema";
import {
  HARD_CAPS,
  specialistQuestionCounts,
  unaskedQuestionKeys,
  validateAnswerLength,
} from "./state-machine";
import { callLLMJson } from "@/lib/ai/client";

// ═══════════════════════════════════════════════════════════════════
// SPECIALIST ROTATION ORDER
// ═══════════════════════════════════════════════════════════════════

const ROTATION: Specialist[] = [
  "technical",
  "finance",
  "marketing",
  "legal",
  "founder",
];

/**
 * Pick the next specialist in round-robin order, respecting the 5-per-specialist cap.
 * Returns null if no specialist has unasked questions remaining.
 */
function pickNextSpecialist(
  specialistCounts: Record<string, number>,
  unasked: Set<string>
): Specialist | null {
  for (const specialist of ROTATION) {
    if (specialistCounts[specialist] >= HARD_CAPS.maxQuestionsPerSpecialist) {
      continue;
    }
    const hasUnasked = QUESTIONS_BY_SPECIALIST[specialist].some((q) =>
      unasked.has(q.key)
    );
    if (hasUnasked) return specialist;
  }
  return null;
}

/**
 * Among unasked questions for a specialist, pick the first one by the
 * canonical order in QUESTIONS. Required questions come before optional.
 */
function pickNextQuestionKey(
  specialist: Specialist,
  unasked: Set<string>
): string | null {
  const candidates = QUESTIONS_BY_SPECIALIST[specialist]
    .filter((q) => unasked.has(q.key))
    .sort((a, b) => Number(b.required) - Number(a.required));
  return candidates[0]?.key ?? null;
}

// ═══════════════════════════════════════════════════════════════════
// LLM PERSONALIZATION
// ═══════════════════════════════════════════════════════════════════

const PersonalizeSchema = z.object({
  personalizedText: z.string().min(10).max(600),
});

async function personalizeQuestion(
  basePrompt: string,
  intake: Record<string, string | undefined>,
  priorTurns: Array<{ questionText: string; answerText: string | null }>
): Promise<string> {
  const context = [
    `Idea title: ${intake.title ?? "Unknown"}`,
    `One-liner: ${intake.oneLiner ?? ""}`,
    `Problem: ${intake.problem ?? ""}`,
    `Solution: ${intake.solution ?? ""}`,
    intake.targetMarket ? `Target market: ${intake.targetMarket}` : "",
    intake.businessModel ? `Business model: ${intake.businessModel}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const recentAnswers = priorTurns
    .slice(-3)
    .map((t) => `Q: ${t.questionText}\nA: ${t.answerText ?? "(skipped)"}`)
    .join("\n\n");

  const prompt = `You are an investor interviewing a founder.

FOUNDER'S IDEA:
${context}

${recentAnswers ? `RECENT EXCHANGE:\n${recentAnswers}\n\n` : ""}

BASE QUESTION (do not change the intent):
"${basePrompt}"

Rewrite the base question so it flows naturally from the recent exchange
and references the founder's specific idea where relevant.

Rules:
- Keep the same underlying intent — do not change what you're asking
- Do not add extra sub-questions
- Keep it under 500 characters
- Return valid json: { "personalizedText": "..." }
`;

  try {
    const result = await callLLMJson(
      prompt,
      "You are an investor conducting an interview. Respond with valid json only.",
      { temperature: 0.3, maxTokens: 300 }
    );
    const parsed = PersonalizeSchema.safeParse(result);
    if (parsed.success) return parsed.data.personalizedText;
  } catch {
    // fall through
  }
  return basePrompt; // fallback to the base text
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════

export type NextQuestion = {
  questionKey: string;
  questionText: string;
  specialist: Specialist;
  isClarification: boolean;
  turnIndex: number;
  isLastRequired: boolean;
};

/**
 * Generate the next question for an interview.
 *
 * @param intake the idea's intake fields
 * @param turns all existing turns for this session
 * @returns the next question, or null if the interview is finished
 */
export async function generateNextQuestion(
  intake: Record<string, string | undefined>,
  turns: Array<{
    questionKey: string;
    specialist: string;
    questionText: string;
    answerText: string | null;
    skipped: boolean;
  }>
): Promise<NextQuestion | null> {
  const askedKeys = new Set(turns.map((t) => t.questionKey));
  const allKeys = QUESTIONS.map((q) => q.key);
  const unaskedList = unaskedQuestionKeys(askedKeys, allKeys);
  const unasked = new Set(unaskedList);

  // If everything's been asked, we're done
  if (unasked.size === 0) return null;

  const counts = specialistQuestionCounts(turns);
  const nextSpecialist = pickNextSpecialist(counts, unasked);
  if (!nextSpecialist) return null;

  const nextKey = pickNextQuestionKey(nextSpecialist, unasked);
  if (!nextKey) return null;

  if (!isValidQuestionKey(nextKey)) {
    throw new Error(`Invalid question key: ${nextKey}`);
  }

  const question = QUESTIONS_BY_KEY[nextKey];
  const personalizedText = await personalizeQuestion(
    question.prompt,
    intake,
    turns.map((t) => ({
      questionText: t.questionText,
      answerText: t.answerText,
    }))
  );

  const turnIndex = turns.length;

  // Is this the last required question remaining?
  const requiredKeys = new Set(
    QUESTIONS.filter((q) => q.required).map((q) => q.key)
  );
  const answeredRequired = turns.filter(
    (t) =>
      requiredKeys.has(t.questionKey) &&
      t.answerText &&
      t.answerText.trim().length > 0
  ).length;
  const totalRequired = requiredKeys.size;
  const isLastRequired =
    question.required && answeredRequired + 1 === totalRequired;

  return {
    questionKey: question.key,
    questionText: personalizedText,
    specialist: question.specialist,
    isClarification: false,
    turnIndex,
    isLastRequired,
  };
}

/**
 * Re-export for use by API routes to validate incoming answers.
 */
export { validateAnswerLength };